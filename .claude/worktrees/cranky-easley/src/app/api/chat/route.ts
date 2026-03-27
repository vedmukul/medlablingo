// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { safetyFilter } from "@/lib/safety/safetyFilter";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/observability/rateLimiter";
import { resolveProvider } from "@/lib/ai/providers/resolve";
import { randomUUID, createHash } from "crypto";

export const runtime = "nodejs";

const MAX_MESSAGES = 20; // cap context window
const MAX_USER_MSG_LENGTH = 1000;

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

function buildSystemPrompt(analysisResult: unknown): string {
    const analysisJson = JSON.stringify(analysisResult, null, 2);

    return `You are MedLabLingo Assistant — an educational AI helping a patient understand their medical document analysis.

STRICT RULES:
- ONLY answer questions based on the analysis result provided below
- NEVER diagnose medical conditions
- NEVER recommend treatments, procedures, or tests
- NEVER suggest medication changes
- If asked something outside the analysis, say "I can only answer questions about your specific document analysis. Please ask your doctor about that."
- Always encourage consulting a healthcare provider for medical decisions
- Be warm, clear, and use plain language (no medical jargon without explanation)
- Keep answers concise (2–4 sentences max unless more detail is genuinely needed)

PATIENT'S ANALYSIS RESULT:
${analysisJson}

Remember: You are educational only. Every answer should help the patient understand their document, not replace their doctor.`;
}

function getMockReply(userMessage: string): string {
    if (userMessage.toLowerCase().includes("glucose") || userMessage.toLowerCase().includes("sugar")) {
        return "Based on your analysis, your glucose level was noted. For a detailed explanation of what this means for your health, please discuss with your doctor. This is educational information only.";
    }
    return "I can help you understand your analysis results. This is a mock response since no AI key is configured. Configure ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY for real answers.";
}

export async function POST(request: Request) {
    const requestId = randomUUID();

    // Rate limit
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { ok: false, error: "Too many requests. Please wait before asking again.", requestId },
            { status: 429 }
        );
    }

    logger.info({ eventName: "chat.started", requestId });

    try {
        const body = await request.json();
        const { messages, analysisResult } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { ok: false, error: "No messages provided.", requestId },
                { status: 400 }
            );
        }

        if (!analysisResult || typeof analysisResult !== "object") {
            return NextResponse.json(
                { ok: false, error: "No analysis result provided for context.", requestId },
                { status: 400 }
            );
        }

        // Validate and sanitize messages
        const sanitizedMessages: Array<{ role: "user" | "assistant"; content: string }> = messages
            .slice(-MAX_MESSAGES) // keep last N
            .map((m: any) => ({
                role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
                content: String(m.content ?? "").slice(0, MAX_USER_MSG_LENGTH),
            }))
            .filter((m: { role: string; content: string }) => m.content.trim().length > 0);

        // Resolve AI provider (Anthropic → Google → OpenAI → Mock)
        const provider = resolveProvider();

        // Mock mode
        if (!provider) {
            const lastUserMsg = sanitizedMessages.filter((m) => m.role === "user").pop()?.content ?? "";
            const mockReply = getMockReply(lastUserMsg);
            return NextResponse.json({ ok: true, reply: mockReply, requestId });
        }

        // Call AI provider
        const systemPrompt = buildSystemPrompt(analysisResult);

        let rawReply: string;
        try {
            if (provider.callChat) {
                rawReply = await provider.callChat(systemPrompt, sanitizedMessages, {
                    temperature: 0.5,
                    maxTokens: 400,
                });
            } else {
                // Fallback: use callAI with the last user message
                const lastUserMsg = sanitizedMessages.filter((m) => m.role === "user").pop()?.content ?? "";
                rawReply = await provider.callAI(systemPrompt, lastUserMsg);
            }
        } catch (error) {
            logger.error({ eventName: "chat.ai_error", requestId });
            throw error;
        }

        // Apply safety filter
        const safeReply = safetyFilter({ reply: rawReply }) as { reply: string };

        logger.info({ eventName: "chat.completed", requestId });

        return NextResponse.json({ ok: true, reply: safeReply.reply, requestId });

    } catch (error) {
        logger.error({
            eventName: "chat.failed",
            requestId,
            error: error instanceof Error ? error.message : "unknown",
        });

        return NextResponse.json(
            {
                ok: false,
                error: "Something went wrong. Please try again.",
                requestId,
            },
            { status: 500 }
        );
    }
}
