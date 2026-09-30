const cacheService = require('../services/cacheService');
const logger = require('../logger');

/**
 * rateLimiter.js
 * 
 * Scalability Component: Uses Redis to limit API requests per IP.
 * Prevents DDoS and API abuse in production.
 */

const rateLimiter = (options = { maxRequests: 50, windowSeconds: 60 }) => {
    return async (req, res, next) => {
        const ip = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/i, '');
        // P1 FIX (#11): loopback bypass only for genuinely local clients in dev.
        // req.ip is trustworthy on every path:
        //  - direct clients: Express ignores X-Forwarded-For from untrusted sockets
        //    (trust proxy = 'loopback'), so a LAN caller cannot forge 127.0.0.1;
        //  - proxied (Next.js rewrites): frontend/scripts/apply-next-xff-patch.js
        //    overwrites x-forwarded-for with the real TCP peer at the proxy boundary,
        //    so req.ip is the browser's actual address (see server.js startup check).
        // In production, loopback callers are counted too.
        const isLocal =
            process.env.NODE_ENV !== 'production' &&
            (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.'));
        if (isLocal) {
            return next();
        }

        // Use trusted req.ip only (X-Forwarded-For is spoofable without a trusted proxy chain)
        const identifier = ip || 'anonymous';
        const key = `ratelimit:${identifier}:${req.baseUrl || req.path}`;
        
        try {
            // P2 #46: single atomic increment (INCR / sync memory mutation)
            // replaces the racy get→mutate→set round-trip, and the TTL is set
            // once per window instead of being reset by every request.
            const count = await cacheService.increment(key, options.windowSeconds);

            if (count > options.maxRequests) {
                logger.warn(`[RateLimiter] Blocked ${identifier} - Exceeded ${options.maxRequests} requests per ${options.windowSeconds}s.`);
                return res.status(429).json({ 
                    success: false, 
                    error: 'Too many requests. Please try again later.' 
                });
            }

            next();
        } catch (e) {
            logger.error(`[RateLimiter] Error: ${e.message}`);
            // Fail closed in production (don't let a cache outage disable limits);
            // fail open in dev so local UX isn't broken by cache issues.
            if (process.env.NODE_ENV === 'production') {
                return res.status(503).json({ success: false, error: 'Rate limiter unavailable' });
            }
            next();
        }
    };
};

module.exports = rateLimiter;
