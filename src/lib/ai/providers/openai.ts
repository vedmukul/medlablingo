// src/lib/ai/providers/openai.ts

import { AIProvider } from "./types";

/**
 * OpenAI provider implementation using GPT-4o-mini
 */
export class OpenAIProvider implements AIProvider {
    name = "openai";
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("OpenAI returned empty response");
        }

        return content;
    }
}
