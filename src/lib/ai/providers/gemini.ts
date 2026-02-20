// src/lib/ai/providers/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider } from "./types";

/**
 * Google Gemini provider implementation using gemini-3-flash-preview
 * 
 * Benefits:
 * - Latest generation (Gen 3) - best reasoning quality
 * - Massive context window (10^7 tokens) - handles very long medical documents
 * - Fast Flash variant optimized for speed
 * - Low cost: $0.60/1M input tokens, $3/1M output tokens
 * - Native JSON mode support
 * - Preview access to cutting-edge capabilities
 */
export class GeminiProvider implements AIProvider {
    name = "gemini";
    private client: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = this.client.getGenerativeModel({
            model: "gemini-3-flash-preview",
            generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
            },
        });
    }

    async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
        try {
            // Gemini combines system and user prompts differently
            // We'll prepend system prompt to user prompt
            const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

            const result = await this.model.generateContent(combinedPrompt);
            const response = result.response;
            const text = response.text();

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
}
