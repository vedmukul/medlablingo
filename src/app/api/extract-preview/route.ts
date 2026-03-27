import { NextResponse } from "next/server";
import { extractText } from "@/lib/pdf/extractText";
import { checkRateLimit } from "@/lib/observability/rateLimiter";
import { logger } from "@/lib/observability/logger";
import { randomUUID, createHash } from "crypto";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 12 * 1024 * 1024; // slightly above upload UI limit for edge cases

function getClientIp(request: Request): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || "unknown";
    return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function redactIpForLogs(ip: string): string {
    if (process.env.NODE_ENV === "development") return ip;
    try {
        return createHash("sha256").update(ip).digest("hex").slice(0, 12);
    } catch {
        return "[REDACTED]";
    }
}

export type ExtractionQuality = "empty" | "low" | "ok";

export async function POST(request: Request) {
    const requestId = randomUUID();
    const route = "/api/extract-preview";

    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { ok: false, error: "Too many requests", requestId },
            { status: 429 }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ ok: false, error: "Missing file", requestId }, { status: 400 });
        }
        if (file.type !== "application/pdf") {
            return NextResponse.json({ ok: false, error: "PDF only", requestId }, { status: 400 });
        }
        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ ok: false, error: "File too large", requestId }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let text = "";
        try {
            text = await extractText(buffer);
        } catch (err) {
            logger.warn({
                eventName: "extract_preview.failed",
                route,
                requestId,
                errorCategory: "EXTRACTION",
                ip: redactIpForLogs(ip),
            });
            return NextResponse.json(
                {
                    ok: false,
                    error: "Could not read this PDF",
                    hint: "It may be encrypted, corrupted, or image-only. Try exporting a text-selectable PDF from your portal.",
                    requestId,
                },
                { status: 422 }
            );
        }

        const trimmed = text.replace(/\s+/g, " ").trim();
        const charCount = trimmed.length;

        let quality: ExtractionQuality = "ok";
        if (charCount === 0) quality = "empty";
        else if (charCount < 200) quality = "low";

        const warnings: string[] = [];
        if (quality === "empty") {
            warnings.push("No selectable text found — this is often a scanned image PDF. Try OCR or a digital copy from your portal.");
        } else if (quality === "low") {
            warnings.push("Very little text was found — summary quality may be poor. A digital (non-scanned) PDF usually works best.");
        }

        logger.info({
            eventName: "extract_preview.ok",
            route,
            requestId,
            charCount,
            quality,
            ip: redactIpForLogs(ip),
        });

        return NextResponse.json({
            ok: true,
            charCount,
            quality,
            warnings,
            preview: trimmed.slice(0, 280),
            requestId,
        });
    } catch (e) {
        logger.error({ eventName: "extract_preview.error", route, requestId });
        return NextResponse.json(
            { ok: false, error: "Preview failed", requestId },
            { status: 500 }
        );
    }
}
