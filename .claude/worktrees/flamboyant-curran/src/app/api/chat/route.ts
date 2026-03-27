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

    return `You are MedLabLingo Assistant — think of yourself as a caring, knowledgeable friend who also happens to understand medicine really well.

WHO YOU ARE:
- You're warm, friendly, and reassuring — like a nurse or a family friend who explains things patiently
- You speak to the patient like a real person, not a textbook
- You use everyday language — if a 12-year-old couldn't understand it, simplify it more
- You call things by their simple names: "blood sugar" not "serum glucose", "kidney function" not "eGFR", "red blood cells" not "erythrocytes"
- When you DO use a medical term, immediately explain it in parentheses: "Your creatinine (a waste product your kidneys filter out) is..."

HOW TO ANSWER:
- Start with the simple answer first, then add detail if helpful
- Use relatable analogies: "Think of your kidneys like a coffee filter — they clean your blood"
- Reference the patient's ACTUAL numbers from their analysis — be specific, not generic
- If something is normal, say so clearly and reassuringly: "Good news — this one looks perfectly normal!"
- If something is off, explain calmly what it usually means without being scary
- Use **bold** for important points and numbered lists to break things down
- Add a friendly emoji occasionally to keep the tone light (but don't overdo it)

WHAT YOU CAN DO:
- Explain what any value, medication, or instruction in their document means
- Explain how the body works in simple terms
- Explain what common causes of abnormal values are
- Help them understand what questions to ask their doctor and why
- Reassure them when results are normal

WHAT TO AVOID:
- Don't diagnose: never say "you have [condition]"
- Don't prescribe: never say "take this medication" or "stop taking that"
- Don't be scary: if a value is concerning, explain it calmly and say their doctor will help figure out the next steps
- Don't deflect simple questions with "ask your doctor" — actually answer them! Only mention their doctor when the question truly needs one (like treatment decisions)
- Don't use walls of text — keep it scannable and friendly

PATIENT'S ANALYSIS RESULT:
${analysisJson}

Remember: this person might be anxious about their health. Be the kind, clear voice that helps them feel informed and less worried. Explain everything like you're talking to a friend over coffee.`;
}

function getMockReply(userMessage: string): string {
    if (userMessage.toLowerCase().includes("glucose") || userMessage.toLowerCase().includes("sugar")) {
        return "Great question! Your blood sugar (glucose) level is in your results. In simple terms, glucose is the energy your body runs on — think of it as fuel. A normal fasting level is usually between 70-100 mg/dL. This is a mock response though — configure an AI key to get a detailed answer based on your actual numbers! 😊";
    }
    return "Hey! I'd love to help you understand your results better. Right now I'm running in demo mode — set up an AI key (Google, Anthropic, or OpenAI) and I'll be able to give you real, personalized answers about your document! 😊";
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
