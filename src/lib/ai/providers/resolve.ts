// src/lib/ai/providers/resolve.ts

import { AIProvider } from "./types";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";

/**
 * Model metadata for the analysis schema's meta.modelInfo field.
 */
export interface ModelInfo {
    provider: "anthropic" | "openai" | "google" | "mock";
    modelName: string;
    temperature: number;
}

/**
 * Resolves the first available AI provider based on configured API keys.
 *
 * Priority: Google Gemini → Anthropic Claude → OpenAI → null (mock)
 *
 * @returns The first available provider, or null if none configured.
 */
export function resolveProvider(): AIProvider | null {
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    if (googleKey) {
        return new GeminiProvider(googleKey);
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
        return new ClaudeProvider(anthropicKey);
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
        return new OpenAIProvider(openaiKey);
    }

    return null;
}

/**
 * Returns model metadata for a given provider (used in meta.modelInfo).
 */
export function getModelInfo(provider: AIProvider): ModelInfo {
    switch (provider.name) {
        case "anthropic":
            return { provider: "anthropic", modelName: "claude-sonnet-4-5", temperature: 0.3 };
        case "gemini":
            return { provider: "google", modelName: "gemini-2.5-flash", temperature: 0.3 };
        case "openai":
            return { provider: "openai", modelName: "gpt-4o-mini", temperature: 0.3 };
        default:
            return { provider: "mock", modelName: "mock", temperature: 0 };
    }
}
