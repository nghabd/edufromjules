/**
 * Caching Layer with Redis Support
 * Provides application-level caching with automatic invalidation
 */

import Redis from "ioredis";
import { logger } from "./logger";

interface CacheOptions {
	ttl?: number; // Time to live in seconds
	tags?: string[]; // Tags for cache invalidation
	serialize?: boolean;
}

class CacheService {
	private redisClient: Redis | null = null;
	private localCache: Map<string, { value: unknown; expireAt: number }> =
		new Map();
	private useRedis: boolean;

	constructor(redisUrl?: string) {
		this.useRedis = !!redisUrl;

		if (this.useRedis && redisUrl) {
			try {
				this.redisClient = new Redis(redisUrl, {
					lazyConnect: true,
					maxRetriesPerRequest: 1,
					enableReadyCheck: false,
					enableOfflineQueue: false,
				});

				this.redisClient.on("error", (error) => {
					logger.warn("[CACHE_REDIS_ERROR]", {
						error: error.message,
					});
					// Fall back to local cache on Redis error
					this.useRedis = false;
				});
			} catch (error) {
				logger.warn("[CACHE_REDIS_INIT]", {
					error: (error as Error).message,
				});
				this.useRedis = false;
			}
		}
	}

	/**
	 * Get value from cache
	 */
	async get<T>(key: string): Promise<T | null> {
		try {
			if (this.useRedis && this.redisClient) {
				const value = await this.redisClient.get(key);
				if (value) {
					logger.debug(`[CACHE_HIT] ${key}`);
					return JSON.parse(value) as T;
				}
			} else {
				const cached = this.localCache.get(key);
				if (cached && cached.expireAt > Date.now()) {
					logger.debug(`[CACHE_HIT] ${key}`);
					return cached.value as T;
				}
				this.localCache.delete(key);
			}

			logger.debug(`[CACHE_MISS] ${key}`);
			return null;
		} catch (error) {
			logger.warn("[CACHE_GET_ERROR]", {
				key,
				error: (error as Error).message,
			});
			return null;
		}
	}

	/**
	 * Set value in cache
	 */
	async set<T>(
		key: string,
		value: T,
		options: CacheOptions = {},
	): Promise<void> {
		try {
			const ttl = options.ttl || 3600; // Default 1 hour

			if (this.useRedis && this.redisClient) {
				const serialized = JSON.stringify(value);
				await this.redisClient.setex(key, ttl, serialized);

				// Set tags for cache invalidation
				if (options.tags?.length) {
					for (const tag of options.tags) {
						const tagKey = `cache:tag:${tag}`;
						await this.redisClient.sadd(tagKey, key);
						// Set tag expiration same as value
						await this.redisClient.expire(tagKey, ttl);
					}
				}
			} else {
				this.localCache.set(key, {
					value,
					expireAt: Date.now() + ttl * 1000,
				});

				// Cleanup expired entries occasionally
				if (this.localCache.size > 1000) {
					this.cleanupLocalCache();
				}
			}

			logger.debug(`[CACHE_SET] ${key} (ttl: ${ttl}s)`);
		} catch (error) {
			logger.warn("[CACHE_SET_ERROR]", {
				key,
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Delete cache entry
	 */
	async delete(key: string): Promise<void> {
		try {
			if (this.useRedis && this.redisClient) {
				await this.redisClient.del(key);
			} else {
				this.localCache.delete(key);
			}

			logger.debug(`[CACHE_DELETE] ${key}`);
		} catch (error) {
			logger.warn("[CACHE_DELETE_ERROR]", {
				key,
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Invalidate all cache entries with given tag
	 */
	async invalidateTag(tag: string): Promise<void> {
		try {
			const tagKey = `cache:tag:${tag}`;

			if (this.useRedis && this.redisClient) {
				const keys = await this.redisClient.smembers(tagKey);
				if (keys.length > 0) {
					await this.redisClient.del(...keys);
					logger.info(`[CACHE_TAG_INVALIDATED] ${tag} (${keys.length} keys)`);
				}
				await this.redisClient.del(tagKey);
			} else {
				// Local cache invalidation by tag
				const keysToDelete: string[] = [];
				for (const [key] of this.localCache) {
					if (key.includes(tag)) {
						keysToDelete.push(key);
					}
				}
				keysToDelete.forEach((key) => this.localCache.delete(key));
				logger.info(
					`[CACHE_TAG_INVALIDATED] ${tag} (${keysToDelete.length} keys)`,
				);
			}
		} catch (error) {
			logger.warn("[CACHE_INVALIDATE_ERROR]", {
				tag,
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Clear all cache
	 */
	async clear(): Promise<void> {
		try {
			if (this.useRedis && this.redisClient) {
				await this.redisClient.flushdb();
				logger.info("[CACHE_CLEARED] Redis cache");
			} else {
				this.localCache.clear();
				logger.info("[CACHE_CLEARED] Local cache");
			}
		} catch (error) {
			logger.warn("[CACHE_CLEAR_ERROR]", {
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Get or set cache (common pattern)
	 */
	async getOrSet<T>(
		key: string,
		fn: () => Promise<T>,
		options: CacheOptions = {},
	): Promise<T> {
		// Try to get from cache
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Not in cache, compute value
		const value = await fn();

		// Store in cache
		await this.set(key, value, options);

		return value;
	}

	/**
	 * Batch get multiple keys
	 */
	async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
		const result = new Map<string, T | null>();

		if (this.useRedis && this.redisClient) {
			try {
				const values = await this.redisClient.mget(...keys);
				keys.forEach((key, index) => {
					const value = values[index];
					result.set(key, value ? (JSON.parse(value) as T) : null);
				});
			} catch (error) {
				logger.warn("[CACHE_MGET_ERROR]", {
					count: keys.length,
					error: (error as Error).message,
				});
				keys.forEach((key) => result.set(key, null));
			}
		} else {
			keys.forEach((key) => {
				const cached = this.localCache.get(key);
				result.set(
					key,
					cached && cached.expireAt > Date.now() ? (cached.value as T) : null,
				);
			});
		}

		return result;
	}

	/**
	 * Batch set multiple keys
	 */
	async mset<T>(entries: Array<[string, T, CacheOptions?]>): Promise<void> {
		for (const [key, value, options] of entries) {
			await this.set(key, value, options);
		}
	}

	/**
	 * Cleanup expired local cache entries
	 */
	private cleanupLocalCache(): void {
		const now = Date.now();
		let deleted = 0;

		for (const [key, cached] of this.localCache) {
			if (cached.expireAt < now) {
				this.localCache.delete(key);
				deleted++;
			}
		}

		if (deleted > 0) {
			logger.debug(`[CACHE_CLEANUP] Deleted ${deleted} expired entries`);
		}
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { type: string; size: number } {
		return {
			type: this.useRedis ? "Redis" : "Local",
			size: this.localCache.size,
		};
	}
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
	if (!cacheServiceInstance) {
		const redisUrl = process.env.REDIS_URL;
		cacheServiceInstance = new CacheService(redisUrl);
	}
	return cacheServiceInstance;
}

/**
 * Cache key builders for common entities
 */
export const cacheKeys = {
	user: (userId: string) => `user:${userId}`,
	userProgress: (userId: string, materialId: string) =>
		`user:${userId}:progress:${materialId}`,
	material: (materialId: string) => `material:${materialId}`,
	materialMetadata: (materialId: string) => `material:${materialId}:metadata`,
	course: (courseId: string) => `course:${courseId}`,
	courseTopics: (courseId: string) => `course:${courseId}:topics`,
	group: (groupId: string) => `group:${groupId}`,
	quiz: (quizId: string) => `quiz:${quizId}`,
	quizQuestions: (quizId: string) => `quiz:${quizId}:questions`,
};

/**
 * Cache tags for invalidation
 */
export const cacheTags = {
	user: "user",
	material: "material",
	course: "course",
	quiz: "quiz",
	progress: "progress",
	group: "group",
};
