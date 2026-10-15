// Helper to check if response indicates rate limit or error
function isRateLimitedOrError(response, status = 200) {
    if (status === 429 || status === 503 || status === 413 || (status >= 400 && status < 600)) return true;
    if (!response || typeof response !== 'string') return false;
    const errorIndicators = [
        'RATE_LIMIT',
        'CIRCUIT_OPEN',
        'rate_limit',
        'Quota exceeded',
        'quota exceeded',
        'API error',
        'API Error',
        'key set nahi hai',
        'service me error',
        'service error',
        'Service Error',
        'temporarily unavailable',
        'unexpected response',
        'All models unavailable',
        'Max retries exceeded'
    ];
    if (errorIndicators.some(indicator => response.includes(indicator))) return true;
    // Bare "429"/"413"/"not found" as the WHOLE (short) response only —
    // real answers may legitimately contain those strings mid-text.
    const trimmed = response.trim();
    if (trimmed.length <= 80) {
        if (/^(429|413|rate.?limit(ed)?|not found)$/i.test(trimmed)) return true;
    }
    // Provider error prefixes
    if (/^(error|failed|http 4\d\d|status 4\d\d)/i.test(trimmed) && trimmed.length < 200) return true;
    return false;
}

// Helper to check if response is a valid AI response
function isValidResponse(response, status = 200) {
    if (!response || typeof response !== 'string' || response.trim().length < 10) return false;
    if (isRateLimitedOrError(response, status)) return false;
    const trimmed = response.trim();
    // Filter out provider safety echo / empty wrappers from free tier models (e.g. OpenRouter "User Safety: safe")
    if (/^(user safety:\s*(safe|unsafe)?|safety:\s*(safe|unsafe)?)$/i.test(trimmed)) return false;
    if (/^(groq|gemini|nvidia|deepseek|openrouter|mistral|together|huggingface|hf).*error/i.test(trimmed)) return false;
    if (trimmed.length < 25 && /^(safe|ok|success|done|received|error|null|undefined)$/i.test(trimmed)) return false;
    return true;
}

// Clean history: dynamic sliding window up to 20 messages and 24,000 char budget
function buildCleanHistory(history, maxMessages = 20, maxTotalChars = 24000) {
    if (!history || !Array.isArray(history)) return [];
    const valid = history.filter(msg => msg && msg.role && msg.content);
    const sliced = valid.slice(-maxMessages);
    let totalChars = 0;
    const result = [];
    for (let i = sliced.length - 1; i >= 0; i--) {
        const item = sliced[i];
        const rawContent = String(item.content || '');
        // Use Array.from for safe Unicode code-point slicing, preventing broken surrogate pairs
        const contentStr = Array.from(rawContent).slice(0, 3000).join('');
        if (totalChars + contentStr.length > maxTotalChars && result.length > 0) {
            break;
        }
        totalChars += contentStr.length;
        result.unshift({
            role: item.role === 'ai' || item.role === 'model' ? 'assistant' : item.role,
            content: contentStr
        });
    }
    return result;
}

module.exports = {
    isRateLimitedOrError,
    isValidResponse,
    buildCleanHistory
};
