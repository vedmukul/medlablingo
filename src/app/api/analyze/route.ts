// src/app/api/analyze/route.ts

import { NextResponse } from "next/server";
import { extractText } from "@/lib/pdf/extractText";
import { DocumentTypeSchema, ReadingLevelSchema } from "@/contracts/analysisSchema";
import { z } from "zod";
import { analyzeDocument } from "@/lib/ai";
import { safetyFilter } from "@/lib/safety/safetyFilter";
import { redact } from "@/lib/safety/redact";
import { auditRedaction } from "@/lib/compliance/audit";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/observability/rateLimiter";
import { randomUUID, createHash } from "crypto";

// Ensure we run on Node.js runtime for crypto, Buffer, and pdf-parse
export const runtime = "nodejs";

// Input validation schema
const RequestSchema = z.object({
    documentType: DocumentTypeSchema,
    readingLevel: ReadingLevelSchema,
});

const MAX_TEXT_LENGTH = 50_000; // 50k chars

function getClientIp(request: Request): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        // "client, proxy1, proxy2" -> take first
        const first = xff.split(",")[0]?.trim();
        if (first) return first;
    }
    const xRealIp = request.headers.get("x-real-ip");
    return xRealIp?.trim() || "unknown";
}

function redactIpForLogs(ip: string): string {
    // In dev: show raw (useful).
    if (process.env.NODE_ENV === "development") return ip;

    // In prod: log a stable hash so you can still correlate abusive clients
    // without storing IP itself.
    try {
        return createHash("sha256").update(ip).digest("hex").slice(0, 12);
    } catch {
        return "[REDACTED]";
    }
}

export async function POST(request: Request) {
    const requestId = randomUUID();
    const startTime = Date.now();
    const durations: Record<string, number> = {};
    const route = "/api/analyze";

    function track<T>(stage: string, fn: () => T): T {
        const start = Date.now();
        try {
            return fn();
        } finally {
            durations[stage] = Date.now() - start;
        }
    }

    async function trackAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
        const start = Date.now();
        try {
            return await fn();
        } finally {
            durations[stage] = Date.now() - start;
        }
    }

    // 0) Rate Limit Guard
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
        logger.warn({
            eventName: "analyze.rate_limited",
            requestId,
            route,
            ip: redactIpForLogs(ip),
        });

        const res = NextResponse.json(
            { ok: false, error: "Too many requests", hint: "Please wait a moment before trying again.", requestId },
            { status: 429 }
        );
        res.headers.set("x-request-id", requestId);
        return res;
    }

    logger.info({ eventName: "analyze.started", requestId, route });

    try {
        // 1) Parse FormData
        const formData = await trackAsync("parse_formdata", () => request.formData());

        const file = formData.get("file") as File | null;
        const documentType = formData.get("documentType");
        const readingLevel = formData.get("readingLevel");

        // 2) Validation
        const inputValidation = await trackAsync("validate_input", async () => {
            if (!file) throw new Error("Missing file");
            if (file.type !== "application/pdf") throw new Error("Invalid file type");

            const result = RequestSchema.safeParse({ documentType, readingLevel });
            if (!result.success) throw result.error;
            return result.data;
        });

        const { documentType: dt, readingLevel: rl } = inputValidation;

        // 3) Extraction
        if (!file) throw new Error("Missing file"); // Satisfy TS
        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";

        try {
            extractedText = await trackAsync("pdf_extract", () => extractText(buffer));
        } catch {
            logger.error({
                eventName: "analyze.failed",
                requestId,
                route,
                errorCategory: "EXTRACTION",
                errorCode: "BAD_PDF",
                durations: { ...durations, total: Date.now() - startTime },
            });

            const res = NextResponse.json(
                {
                    ok: false,
                    error: "Text extraction failed",
                    hint: "Try a clearer PDF or text-selectable PDF",
                    requestId,
                },
                { status: 422 }
            );
            res.headers.set("x-request-id", requestId);
            return res;
        }

        if (!extractedText.trim()) {
            logger.warn({
                eventName: "analyze.failed",
                requestId,
                route,
                errorCategory: "EXTRACTION",
                errorCode: "EMPTY_TEXT",
                durations: { ...durations, total: Date.now() - startTime },
            });

            const res = NextResponse.json(
                {
                    ok: false,
                    error: "No text found",
                    hint: "The PDF might be scanned images. Try a digital PDF.",
                    requestId,
                },
                { status: 422 }
            );
            res.headers.set("x-request-id", requestId);
            return res;
        }

        // 4) Guardrail: Truncation
        const originalLength = extractedText.length;
        let isTruncated = false;

        if (originalLength > MAX_TEXT_LENGTH) {
            extractedText = extractedText.substring(0, MAX_TEXT_LENGTH);
            isTruncated = true;

            logger.warn({
                eventName: "analyze.truncated",
                requestId,
                route,
                originalLength,
                truncatedLength: extractedText.length,
                limit: MAX_TEXT_LENGTH,
            });
        }

        // 5) Generate redacted preview (first 300 chars)
        const previewRaw = extractedText.substring(0, 300).replace(/\s+/g, " ").trim();
        const extractionPreview = track("preview_redact", () => redact(previewRaw));
        auditRedaction("preview_generation", previewRaw.length);

        // 6) AI analysis
        const analysis = await trackAsync("ai_analyze", () =>
            analyzeDocument({
                text: extractedText, // analyzeDocument() redacts internally; we also truncated already.
                documentType: dt,
                readingLevel: rl,
            })
        );

        // 7) Safety filter
        const safeAnalysis = track("safety_filter", () => safetyFilter(analysis));

        // 8) Completion log
        logger.info({
            eventName: "analyze.completed",
            requestId,
            route,
            documentType: dt,
            readingLevel: rl,
            extractedTextLength: extractedText.length,
            previewLength: extractionPreview.length,
            durations: { ...durations, total: Date.now() - startTime },
            truncated: isTruncated,
            status: "ok",
        });

        // 9) Return safe payload + header
        const res = NextResponse.json({
            ok: true,
            documentType: dt,
            readingLevel: rl,
            extractedTextLength: extractedText.length,
            extractionPreview,
            result: safeAnalysis,
            requestId,
        });

        res.headers.set("x-request-id", requestId);
        return res;

    } catch (error) {
        let statusCode = 500;
        let errorMessage = "Internal Server Error";
        let errorCode = "UNKNOWN";
        let errorCategory = "UNKNOWN";

        if (error instanceof z.ZodError) {
            statusCode = 400;
            errorMessage = "Invalid parameters";
            errorCode = "VALIDATION_FAIL";
            errorCategory = "VALIDATION";
        } else if (error instanceof Error) {
            if (error.message === "Missing file") {
                statusCode = 400;
                errorMessage = "Missing file";
                errorCode = "MISSING_FILE";
                errorCategory = "VALIDATION";
            } else if (error.message === "Invalid file type") {
                statusCode = 400;
                errorMessage = "Invalid file type";
                errorCode = "BAD_FILE_TYPE";
                errorCategory = "VALIDATION";
            }
        }

        logger.error({
            eventName: "analyze.failed",
            requestId,
            route,
            errorCategory,
            errorCode,
            durations: { ...durations, total: Date.now() - startTime },
            errorObject: error, // logger sanitizes Error safely
        });

        const res = NextResponse.json(
            {
                ok: false,
                error: errorMessage,
                requestId,
                ...(process.env.NODE_ENV === "development" && {
                    details: error instanceof Error ? error.message : String(error),
                }),
            },
            { status: statusCode }
        );
        res.headers.set("x-request-id", requestId);
        return res;
    }
}