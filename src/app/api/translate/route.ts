import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/providers/resolve";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/observability/rateLimiter";
import { randomUUID, createHash } from "crypto";

export const runtime = "nodejs";

const SUPPORTED_LANGUAGES: Record<string, string> = {
    es: "Spanish",
    fr: "French",
    de: "German",
    zh: "Simplified Chinese",
    hi: "Hindi",
    ar: "Arabic",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    vi: "Vietnamese",
    tl: "Tagalog",
    pa: "Punjabi",
    bn: "Bengali",
    ur: "Urdu",
};

function getClientIp(request: Request): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || "unknown";
    return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
    const requestId = randomUUID();

    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { ok: false, error: "Too many requests. Please wait a moment.", requestId },
            { status: 429 }
        );
    }

    logger.info({ eventName: "translate.started", requestId });

    try {
        const body = await request.json();
        const { texts, targetLanguage } = body;

        if (!targetLanguage || !SUPPORTED_LANGUAGES[targetLanguage]) {
            return NextResponse.json(
                { ok: false, error: "Unsupported language.", requestId },
                { status: 400 }
            );
        }

        if (!texts || typeof texts !== "object" || Object.keys(texts).length === 0) {
            return NextResponse.json(
                { ok: false, error: "No text provided for translation.", requestId },
                { status: 400 }
            );
        }

        const provider = resolveProvider();

        if (!provider) {
            return NextResponse.json(
                { ok: false, error: "No AI provider configured.", requestId },
                { status: 503 }
            );
        }

        const langName = SUPPORTED_LANGUAGES[targetLanguage];

        const systemPrompt = `You are a professional medical document translator. Translate the provided JSON values from English to ${langName}.

RULES:
- Translate ONLY the string values in the JSON object
- Keep all JSON keys exactly as they are (in English)
- Preserve medical terminology accuracy — use the commonly understood term in ${langName}
- Keep the tone clear, warm, and patient-friendly
- Do NOT add any medical advice or interpretation — translate faithfully
- Output ONLY valid JSON with the same structure as input
- Do NOT include markdown code fences or any text outside the JSON`;

        const userPrompt = `Translate all values in this JSON to ${langName}. Return ONLY the translated JSON with identical keys:

${JSON.stringify(texts, null, 2)}`;

        let rawReply: string;
        try {
            rawReply = await provider.callAI(systemPrompt, userPrompt);
        } catch (error) {
            logger.error({ eventName: "translate.ai_error", requestId });
            throw error;
        }

        let translated: Record<string, unknown>;
        try {
            translated = JSON.parse(rawReply);
        } catch {
            const start = rawReply.indexOf("{");
            const end = rawReply.lastIndexOf("}");
            if (start !== -1 && end > start) {
                translated = JSON.parse(rawReply.slice(start, end + 1));
            } else {
                throw new Error("Translation returned invalid JSON");
            }
        }

        logger.info({ eventName: "translate.completed", requestId, targetLanguage });

        return NextResponse.json({
            ok: true,
            targetLanguage,
            translated,
            requestId,
        });
    } catch (error) {
        logger.error({
            eventName: "translate.failed",
            requestId,
            error: error instanceof Error ? error.message : "unknown",
        });

        return NextResponse.json(
            { ok: false, error: "Translation failed. Please try again.", requestId },
            { status: 500 }
        );
    }
}
