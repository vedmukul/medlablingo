// src/lib/ai/providers/types.ts

/**
 * Common interface for AI providers
 */
export interface AIProvider {
    /**
     * Calls the AI provider with system and user prompts
     * @param systemPrompt - System instructions/context
     * @param userPrompt - User query/request
     * @returns Promise<string> - AI response (typically JSON)
     */
    callAI(systemPrompt: string, userPrompt: string): Promise<string>;

    /**
     * Provider name for logging and debugging
     */
    name: string;
}
