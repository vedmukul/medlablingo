import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/observability/rateLimiter";
import { randomUUID, createHash } from "crypto";

export const runtime = "nodejs";

const BodySchema = z.object({
    helpful: z.boolean().nullable(),
    comment: z.string().max(2000).optional(),
    requestId: z.string().max(80).optional(),
    page: z.string().max(120).optional(),
    schemaVersion: z.string().max(20).optional(),
});

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

export async function POST(request: Request) {
    const requestId = randomUUID();
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
        return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const { helpful, comment, requestId: clientRid, page, schemaVersion } = parsed.data;

    logger.info({
        eventName: "feedback.submitted",
        requestId,
        clientRequestId: clientRid,
        helpful,
        hasComment: Boolean(comment?.trim()),
        page,
        schemaVersion,
        ip: redactIpForLogs(ip),
    });

    const webhook = process.env.FEEDBACK_WEBHOOK_URL;
    if (webhook) {
        try {
            await fetch(webhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    helpful,
                    comment: comment?.slice(0, 2000),
                    clientRequestId: clientRid,
                    page,
                    schemaVersion,
                    serverRequestId: requestId,
                    receivedAt: new Date().toISOString(),
                }),
            });
        } catch {
            // non-fatal
        }
    }

    return NextResponse.json({ ok: true, requestId });
}
