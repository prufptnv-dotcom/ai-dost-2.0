/**
 * Frontend Logger Utility
 * In production (process.env.NODE_ENV === 'production'):
 * - Debug and info logs are suppressed.
 * - Warn and error logs are enabled for diagnostics.
 * In development:
 * - All levels are printed with clean prefixing.
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => {
    if (IS_DEV) console.log('[AI-Dost]', ...args);
  },
  info: (...args) => {
    if (IS_DEV) console.info('[AI-Dost Info]', ...args);
  },
  warn: (...args) => {
    console.warn('[AI-Dost Warning]', ...args);
  },
  error: (...args) => {
    console.error('[AI-Dost Error]', ...args);
  }
};

export default logger;
