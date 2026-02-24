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
     * Calls the AI provider with multi-turn conversation history.
     * Used by the chat endpoint for follow-up questions.
     * @param systemPrompt - System instructions/context
     * @param messages - Conversation history
     * @param options - Optional temperature and maxTokens overrides
     * @returns Promise<string> - AI response text
     */
    callChat?(
        systemPrompt: string,
        messages: Array<{ role: "user" | "assistant"; content: string }>,
        options?: { temperature?: number; maxTokens?: number }
    ): Promise<string>;

    /**
     * Provider name for logging and debugging
     */
    name: string;
}
