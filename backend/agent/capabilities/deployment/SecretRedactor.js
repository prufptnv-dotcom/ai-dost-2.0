'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: SecretRedactor
 * 
 * High-performance credential and token masking engine.
 * Redacts known secret patterns from strings, objects, and error traces.
 */

const URL_AUTH_PATTERN = /:\/\/[^:\/\s]+:[^@\/\s]+@/g;

const SECRET_PATTERNS = [
  // Google / Gemini API Keys
  /AIza[0-9A-Za-z-_]{35,45}/g,
  // Groq API Keys
  /gsk_[0-9A-Za-z]{48,64}/g,
  // OpenAI / standard sk- keys
  /sk-[0-9A-Za-z-_]{20,64}/g,
  // Generic Bearer tokens
  /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi,
  // Private Key blocks
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[^-]+-----END [A-Z ]*PRIVATE KEY-----/gs,
  // Generic token / secret assignments in env/json: SECRET=xxx, token: "xxx"
  /(?:password|passwd|secret|token|api[_-]?key|auth[_-]?key|access[_-]?key)\s*[:=]\s*["']?([^"'\s\r\n]{4,})["']?/gi
];

class SecretRedactor {
  /**
   * Redact sensitive tokens and credentials from a string
   * @param {string} text - Raw string
   * @returns {string} Redacted string
   */
  static redactString(text) {
    if (typeof text !== 'string') return text;
    let sanitized = text;

    // 1. Redact URL basic auth credentials
    sanitized = sanitized.replace(URL_AUTH_PATTERN, '://[REDACTED_CREDS]@');

    // 2. Redact explicit patterns
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.source.includes('password|passwd')) {
        sanitized = sanitized.replace(pattern, (match, secretVal) => {
          if (!secretVal) return match;
          return match.replace(secretVal, '[REDACTED_SECRET]');
        });
      } else {
        sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
      }
    }

    return sanitized;
  }

  /**
   * Deeply redact sensitive fields from an object or array
   * @param {any} data - Object, array, or primitive
   * @returns {any} Sanitized clone
   */
  static redactObject(data) {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return this.redactString(data);
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map(item => this.redactObject(item));
    }

    const sanitized = {};
    const sensitiveKeyPattern = /^(password|passwd|secret|token|api[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)$/i;

    for (const [key, val] of Object.entries(data)) {
      if (sensitiveKeyPattern.test(key) && typeof val === 'string') {
        sanitized[key] = '[REDACTED_SECRET]';
      } else if (typeof val === 'string') {
        sanitized[key] = this.redactString(val);
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.redactObject(val);
      } else {
        sanitized[key] = val;
      }
    }

    return sanitized;
  }
}

module.exports = {
  SecretRedactor
};
