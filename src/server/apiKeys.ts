/**
 * API Key Management Utility
 * Handles API key resolution from request headers, user-provided keys, and environment variables,
 * with full support for Railway deployment environments.
 */

export type AIProvider = 'OpenRouter' | 'Venice' | 'Gemini' | 'OpenAI' | 'xAI';

/**
 * Get the effective API key for a provider
 * @param provider - The AI provider name
 * @param userKey - Optional user-provided API key from frontend
 * @returns The effective API key or null if not found
 */
export function getEffectiveKey(provider: AIProvider, userKey?: string): string | null {
    // 1. Use user-provided key if provided and non-empty
    if (userKey && typeof userKey === 'string' && userKey.trim().length > 0) {
        return userKey.trim();
    }
    
    // 2. Otherwise fall back to environment variables (supports standard & Railway envs)
    const keyMap: Record<AIProvider, string | undefined> = {
        'OpenRouter': process.env.OPENROUTER_API_KEY || process.env.RAILWAY_OPENROUTER_API_KEY,
        'Venice': process.env.VENICE_API_KEY || process.env.RAILWAY_VENICE_API_KEY,
        'Gemini': process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.RAILWAY_GEMINI_API_KEY,
        'OpenAI': process.env.OPENAI_API_KEY || process.env.RAILWAY_OPENAI_API_KEY,
        'xAI': process.env.XAI_API_KEY || process.env.RAILWAY_XAI_API_KEY
    };
    
    return keyMap[provider] || null;
}

/**
 * Extract the effective API key dynamically from request headers or body, falling back to server environment.
 */
export function extractKeyFromRequest(
    provider: AIProvider,
    req: { headers?: Record<string, any>; body?: Record<string, any> }
): string | null {
    const headers = req.headers || {};
    const body = req.body || {};

    const headerMap: Record<AIProvider, string[]> = {
        'Gemini': ['x-gemini-api-key', 'x-gemini-key', 'x-google-api-key'],
        'OpenAI': ['x-openai-api-key', 'x-openai-key'],
        'OpenRouter': ['x-openrouter-api-key', 'x-openrouter-key'],
        'Venice': ['x-venice-api-key', 'x-venice-key'],
        'xAI': ['x-xai-api-key', 'x-xai-key', 'x-grok-api-key']
    };

    // 1. Check provider-specific header
    const targetHeaders = headerMap[provider] || [];
    for (const h of targetHeaders) {
        const val = headers[h] || headers[h.toLowerCase()];
        if (typeof val === 'string' && val.trim().length > 0) {
            return val.trim();
        }
    }

    // 2. Check generic custom API key headers
    const genericHeaders = ['x-api-key', 'x-custom-api-key', 'x-provider-key'];
    for (const h of genericHeaders) {
        const val = headers[h] || headers[h.toLowerCase()];
        if (typeof val === 'string' && val.trim().length > 0) {
            return val.trim();
        }
    }

    // 3. Check Authorization header (Bearer token)
    const auth = headers['authorization'] || headers['Authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        const token = auth.substring(7).trim();
        if (token) return token;
    }

    // 4. Check body.apiKey
    if (body.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim().length > 0) {
        return body.apiKey.trim();
    }

    // 5. Fallback to server env
    return getEffectiveKey(provider);
}

/**
 * Check if an API key is configured for a provider (either via env or custom key)
 * @param provider - The AI provider name
 * @param userKey - Optional user-provided key
 * @returns True if key is available
 */
export function hasKey(provider: AIProvider, userKey?: string): boolean {
    return getEffectiveKey(provider, userKey) !== null;
}

/**
 * Get status map of all configured provider keys on the server environment
 */
export function getServerKeyStatus(): Record<AIProvider, boolean> {
    return {
        'Gemini': !!(process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.RAILWAY_GEMINI_API_KEY),
        'OpenRouter': !!(process.env.OPENROUTER_API_KEY || process.env.RAILWAY_OPENROUTER_API_KEY),
        'Venice': !!(process.env.VENICE_API_KEY || process.env.RAILWAY_VENICE_API_KEY),
        'OpenAI': !!(process.env.OPENAI_API_KEY || process.env.RAILWAY_OPENAI_API_KEY),
        'xAI': !!(process.env.XAI_API_KEY || process.env.RAILWAY_XAI_API_KEY),
    };
}
