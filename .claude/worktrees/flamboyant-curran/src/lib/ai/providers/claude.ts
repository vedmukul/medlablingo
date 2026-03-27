// src/lib/ai/providers/claude.ts

import Anthropic from "@anthropic-ai/sdk";
import { AIProvider } from "./types";

/**
 * Anthropic Claude provider implementation using claude-sonnet-4-5
 *
 * Benefits:
 * - Strong reasoning and instruction-following for medical document analysis
 * - Native system prompt support via the `system` parameter
 * - Good balance of quality, speed, and cost for structured extraction
 */
export class ClaudeProvider implements AIProvider {
    name = "anthropic";
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({ apiKey });
    }

    async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
        try {
            const message = await this.client.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 8192,
                temperature: 0.3,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
            });

            const text = this.extractText(message);
            return this.extractJson(text);
        } catch (error) {
            throw this.wrapError(error);
        }
    }

    async callChat(
        systemPrompt: string,
        messages: Array<{ role: "user" | "assistant"; content: string }>,
        options?: { temperature?: number; maxTokens?: number }
    ): Promise<string> {
        try {
            const message = await this.client.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: options?.maxTokens ?? 400,
                temperature: options?.temperature ?? 0.5,
                system: systemPrompt,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            });

            return this.extractText(message);
        } catch (error) {
            throw this.wrapError(error);
        }
    }

    private extractText(message: Anthropic.Message): string {
        const block = message.content[0];
        if (!block || block.type !== "text") {
            throw new Error("Claude returned empty or non-text response");
        }
        return block.text;
    }

    /**
     * Extracts JSON from Claude's response, handling:
     * - Plain JSON responses
     * - Markdown code fences (```json...```)
     * - Extra text before/after the JSON object
     */
    private extractJson(text: string): string {
        const trimmed = text.trim();

        // Fast path: already valid JSON
        if (trimmed.startsWith("{")) return trimmed;

        // Find outermost JSON object by scanning for first { and last }
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");

        if (start !== -1 && end !== -1 && end > start) {
            return trimmed.slice(start, end + 1);
        }

        // Fallback: strip code fences and return
        return trimmed
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();
    }


    private wrapError(error: unknown): Error {
        if (error instanceof Anthropic.APIError) {
            return new Error(`Claude API error (${error.status}): ${error.message}`);
        }
        if (error instanceof Error) {
            return new Error(`Claude API error: ${error.message}`);
        }
        return new Error("Claude API error: Unknown error");
    }
}
