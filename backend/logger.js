/**
 * Lightweight logger for AI-Dost backend.
 * - In production (NODE_ENV=production): only WARN and ERROR are printed.
 * - In development: all levels are printed with timestamps and colors.
 * - Zero external dependencies — uses only Node.js built-ins.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

const COLORS = {
  reset:  '\x1b[0m',
  grey:   '\x1b[90m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  bold:   '\x1b[1m',
};

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = IS_PROD ? LEVELS.warn : LEVELS.debug;

// Metrics tracking
const metrics = {
  requests: 0,
  errors: 0,
  rateLimits: 0,
  fallbacks: 0,
  modelUsage: {},
  responseTimes: []
};

function timestamp() {
  return new Date().toISOString();
}

function format(level, label, msg, ...args) {
  const ts = `${COLORS.grey}${timestamp()}${COLORS.reset}`;
  const lvlColors = {
    debug: COLORS.grey,
    info:  COLORS.cyan,
    warn:  COLORS.yellow,
    error: COLORS.red,
  };
  const lvl = `${lvlColors[level]}${COLORS.bold}[${level.toUpperCase()}]${COLORS.reset}`;
  const lbl = label ? `${COLORS.cyan}[${label}]${COLORS.reset}` : '';
  return [ts, lvl, lbl, msg, ...args].filter(Boolean);
}

function createLogger(label = '') {
  return {
    debug: (msg, ...args) => {
      if (LEVELS.debug >= MIN_LEVEL) console.log(...format('debug', label, msg, ...args));
    },
    info: (msg, ...args) => {
      if (LEVELS.info >= MIN_LEVEL) console.log(...format('info', label, msg, ...args));
    },
    warn: (msg, ...args) => {
      if (LEVELS.warn >= MIN_LEVEL) console.warn(...format('warn', label, msg, ...args));
    },
    error: (msg, ...args) => {
      console.error(...format('error', label, msg, ...args));
    },
    /** HTTP request logger — always active */
    http: (method, url, status, ms) => {
      const color = status >= 500 ? COLORS.red : status >= 400 ? COLORS.yellow : COLORS.cyan;
      console.log(
        `${COLORS.grey}${timestamp()}${COLORS.reset}`,
        `${color}${COLORS.bold}[HTTP]${COLORS.reset}`,
        `${method} ${url} ${color}${status}${COLORS.reset} (${ms}ms)`
      );
    },
    /** Metrics tracking */
    metric: {
      request: (model) => {
        metrics.requests++;
        if (model) {
          metrics.modelUsage[model] = (metrics.modelUsage[model] || 0) + 1;
        }
      },
      error: () => { metrics.errors++; },
      rateLimit: () => { metrics.rateLimits++; },
      fallback: () => { metrics.fallbacks++; },
      responseTime: (ms) => { 
        metrics.responseTimes.push(ms);
        if (metrics.responseTimes.length > 1000) metrics.responseTimes.shift();
      },
      get: () => ({
        ...metrics,
        avgResponseTime: metrics.responseTimes.length > 0 
          ? Math.round(metrics.responseTimes.reduce((a,b) => a+b, 0) / metrics.responseTimes.length)
          : 0
      }),
      reset: () => {
        metrics.requests = 0;
        metrics.errors = 0;
        metrics.rateLimits = 0;
        metrics.fallbacks = 0;
        metrics.modelUsage = {};
        metrics.responseTimes = [];
      }
    }
  };
}

// Default root logger
const logger = createLogger();

// Named logger factory
logger.child = createLogger;

module.exports = logger;
