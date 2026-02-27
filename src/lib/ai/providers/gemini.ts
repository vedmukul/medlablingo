// src/lib/ai/providers/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider } from "./types";

/**
 * Google Gemini provider implementation using gemini-2.5-flash
 *
 * Benefits:
 * - Stable production-ready model, best price-performance
 * - 1M token context window — handles very long medical documents
 * - Extremely fast (~5s per request)
 * - Native JSON mode support (responseMimeType)
 */
export class GeminiProvider implements AIProvider {
    name = "gemini";
    private client: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = this.client.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
                // @ts-ignore — thinkingConfig is supported by the API but not yet in the SDK types
                thinkingConfig: { thinkingBudget: 0 },
            } as any,
        });
    }

    async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
        try {
            const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

            const result = await this.model.generateContent(combinedPrompt);
            const text = result.response.text();

            if (!text) {
                throw new Error("Gemini returned empty response");
            }

            return this.extractJson(text);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Gemini API error: ${error.message}`);
            }
            throw new Error("Gemini API error: Unknown error");
        }
    }

    async callChat(
        systemPrompt: string,
        messages: Array<{ role: "user" | "assistant"; content: string }>,
        options?: { temperature?: number; maxTokens?: number }
    ): Promise<string> {
        try {
            const conversationText = messages
                .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
                .join("\n\n");
            const combinedPrompt = `${systemPrompt}\n\nConversation so far:\n${conversationText}\n\nAssistant:`;

            const chatModel = this.client.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: options?.temperature ?? 0.5,
                    maxOutputTokens: options?.maxTokens ?? 400,
                    // @ts-ignore
                    thinkingConfig: { thinkingBudget: 0 },
                } as any,
            });

            const result = await chatModel.generateContent(combinedPrompt);
            const text = result.response.text();

            if (!text) {
                throw new Error("Gemini returned empty response");
            }

            return text;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Gemini API error: ${error.message}`);
            }
            throw new Error("Gemini API error: Unknown error");
        }
    }

    private extractJson(text: string): string {
        const trimmed = text.trim();
        if (trimmed.startsWith("{")) return trimmed;

        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        if (start !== -1 && end > start) {
            return trimmed.slice(start, end + 1);
        }

        return trimmed
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();
    }
}
