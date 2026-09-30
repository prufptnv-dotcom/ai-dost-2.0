const Redis = require('ioredis');
const logger = require('../logger');

/**
 * cacheService.js
 * 
 * Scalability Component: Handles caching of expensive AI tasks and web searches.
 * Gracefully degrades to a memory Map if Redis is not available or connection fails,
 * ensuring zero downtime.
 */

class CacheService {
    constructor() {
        this.redis = null;
        this.memoryCache = new Map();
        this.isRedisConnected = false;

        // P2 #47: bound the memory fallback — expired entries are swept on a
        // timer (lazy delete on get alone never reclaims never-read keys) and
        // total size is capped with oldest-first eviction.
        this.maxMemoryEntries = Number(process.env.CACHE_MAX_MEMORY_ENTRIES || 5000);
        this.sweepTimer = setInterval(() => this.sweepExpired(), 60 * 1000);
        if (typeof this.sweepTimer.unref === 'function') this.sweepTimer.unref();

        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

        try {
            this.redis = new Redis(redisUrl, {
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.warn(`[CacheService] Redis unreachable after 3 attempts. Using fallback Memory Cache.`);
                        return null; // Stop retrying
                    }
                    return Math.min(times * 50, 2000);
                },
                maxRetriesPerRequest: 1
            });

            // Don't hold the event loop open (tests / graceful exit)
            if (typeof this.redis.stream?.unref === 'function') {
                this.redis.stream.unref();
            }

            this.redis.on('connect', () => {
                this.isRedisConnected = true;
                logger.info(`[CacheService] Connected to Redis successfully.`);
            });

            this.redis.on('error', (err) => {
                this.isRedisConnected = false;
                // Suppress constant error logging after initial failure
            });
        } catch (e) {
            logger.warn(`[CacheService] Failed to initialize Redis. Using fallback Memory Cache.`);
        }
    }

    /**
     * Gets a value from cache
     */
    async get(key) {
        try {
            if (this.isRedisConnected) {
                const val = await this.redis.get(key);
                return val ? JSON.parse(val) : null;
            }
        } catch (e) {
            // Fallback to memory on redis failure
        }
        
        // Memory fallback
        const item = this.memoryCache.get(key);
        if (item && item.expiry > Date.now()) {
            return item.value;
        } else if (item) {
            this.memoryCache.delete(key);
        }
        return null;
    }

    /**
     * Sets a value in cache
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlSeconds Time to live in seconds
     */
    async set(key, value, ttlSeconds = 3600) {
        try {
            if (this.isRedisConnected) {
                await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
                return;
            }
        } catch (e) {
            // Fallback
        }
        
        // Memory fallback
        this.memoryCache.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
        if (this.memoryCache.size > this.maxMemoryEntries) {
            this.sweepExpired();
        }
    }

    /**
     * P2 #47: remove expired entries and enforce the size cap.
     */
    sweepExpired() {
        const now = Date.now();
        for (const [key, item] of this.memoryCache) {
            if (!item || item.expiry <= now) {
                this.memoryCache.delete(key);
            }
        }
        if (this.memoryCache.size > this.maxMemoryEntries) {
            const excess = this.memoryCache.size - this.maxMemoryEntries;
            let removed = 0;
            // Map iterates in insertion order -> drop oldest entries first
            for (const key of this.memoryCache.keys()) {
                if (removed >= excess) break;
                this.memoryCache.delete(key);
                removed++;
            }
        }
    }

    /**
     * P2 #46: atomic counter for rate limiting.
     * Redis path uses INCR (server-side atomic); memory path mutates
     * synchronously (atomic within Node's event loop). Expiry is set only when
     * the key is created — increments never reset the TTL, so the window is a
     * proper fixed window instead of a perpetually-extended one.
     * @returns {Promise<number>} new count after increment
     */
    async increment(key, ttlSeconds = 3600) {
        try {
            if (this.isRedisConnected) {
                const count = await this.redis.incr(key);
                const ttl = await this.redis.ttl(key);
                if (count === 1 || ttl < 0) {
                    await this.redis.expire(key, ttlSeconds);
                }
                return count;
            }
        } catch (e) {
            // Fallback to memory on redis failure
        }

        const now = Date.now();
        const item = this.memoryCache.get(key);
        if (!item || item.expiry <= now) {
            this.memoryCache.set(key, {
                value: { count: 1 },
                expiry: now + ttlSeconds * 1000,
            });
            return 1;
        }
        item.value.count = (item.value.count || 0) + 1;
        if (this.memoryCache.size > this.maxMemoryEntries) {
            this.sweepExpired();
        }
        return item.value.count;
    }

    /**
     * Cache wrapper: Returns cached data if available, else runs the function and caches it.
     */
    async remember(key, ttlSeconds, fetchFunction) {
        const cached = await this.get(key);
        if (cached) {
            logger.info(`[CacheService] HIT: ${key}`);
            return cached;
        }

        logger.info(`[CacheService] MISS: ${key}. Fetching new data...`);
        const freshData = await fetchFunction();
        
        if (freshData) {
            await this.set(key, freshData, ttlSeconds);
        }
        
        return freshData;
    }
}

module.exports = new CacheService();
