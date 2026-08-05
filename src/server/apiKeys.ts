/**
 * API Key Management Utility
 * Handles API key resolution from environment variables or user-provided keys
 */

export type AIProvider = 'OpenRouter' | 'Venice' | 'Gemini' | 'OpenAI' | 'xAI';

/**
 * Get the effective API key for a provider
 * @param provider - The AI provider name
 * @param userKey - Optional user-provided API key
 * @returns The effective API key or null if not found
 */
export function getEffectiveKey(provider: AIProvider, userKey?: string): string | null {
    // Use user-provided key if available
    if (userKey) return userKey;
    
    // Otherwise use environment variables
    const keyMap: Record<AIProvider, string | undefined> = {
        'OpenRouter': process.env.OPENROUTER_API_KEY,
        'Venice': process.env.VENICE_API_KEY,
        'Gemini': process.env.GEMINI_API_KEY,
        'OpenAI': process.env.OPENAI_API_KEY,
        'xAI': process.env.XAI_API_KEY
    };
    
    return keyMap[provider] || null;
}

/**
 * Check if an API key is configured for a provider
 * @param provider - The AI provider name
 * @returns True if key is available
 */
export function hasKey(provider: AIProvider): boolean {
    return getEffectiveKey(provider) !== null;
}
