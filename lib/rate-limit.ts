import Redis from "ioredis";

interface RateLimitRecord {
	count: number;
	resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
let redisClient: Redis | null = null;

interface RateLimitOptions {
	windowMs: number;
	maxRequests: number;
}

interface RateLimitResult {
	success: boolean;
	remaining: number;
	resetIn?: number;
	retryAfter?: number;
}

function getRedisClient(): Redis | null {
	if (!process.env.REDIS_URL) return null;
	if (!redisClient) {
		redisClient = new Redis(process.env.REDIS_URL, {
			lazyConnect: true,
			maxRetriesPerRequest: 1,
		});
	}
	return redisClient;
}

function rateLimitInMemory(
	identifier: string,
	options: RateLimitOptions,
): RateLimitResult {
	const { windowMs, maxRequests } = options;
	const now = Date.now();
	const record = rateLimitMap.get(identifier);

	if (!record || now > record.resetTime) {
		rateLimitMap.set(identifier, {
			count: 1,
			resetTime: now + windowMs,
		});
		return {
			success: true,
			remaining: maxRequests - 1,
		};
	}

	if (record.count >= maxRequests) {
		const resetIn = Math.ceil((record.resetTime - now) / 1000);
		return {
			success: false,
			remaining: 0,
			resetIn,
			retryAfter: resetIn,
		};
	}

	record.count++;
	return {
		success: true,
		remaining: maxRequests - record.count,
	};
}

export async function rateLimit(
	identifier: string | Request,
	options: RateLimitOptions | string,
): Promise<RateLimitResult> {
	let id: string;
	let opts: RateLimitOptions;

	// Handle both function signatures for backward compatibility
	if (identifier instanceof Request) {
		// New signature: rateLimit(request, endpointType)
		const ip =
			identifier.headers.get("x-forwarded-for") ||
			identifier.headers.get("x-real-ip") ||
			"unknown";
		const endpointType = typeof options === "string" ? options : "default";
		id = `${ip}:${endpointType}`;

		// Get limit from env or use defaults
		const envLimits: Record<string, number> = {
			"storage-upload": parseInt(
				process.env.RATE_LIMIT_STORAGE_ENDPOINT_REQUESTS || "50",
				10,
			),
			default: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
		};

		opts = {
			windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
			maxRequests: envLimits[endpointType] || envLimits["default"],
		};
	} else {
		// Legacy signature: rateLimit(identifier, options)
		id = identifier;
		opts = options as RateLimitOptions;
	}

	const client = getRedisClient();
	if (!client) return rateLimitInMemory(id, opts);

	const { windowMs, maxRequests } = opts;
	const key = `rate_limit:${id}`;

	try {
		if (client.status !== "ready") {
			await client.connect();
		}
		const count = await client.incr(key);
		if (count === 1) {
			await client.pexpire(key, windowMs);
		}

		const ttlMs = await client.pttl(key);
		const resetIn =
			ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);

		if (count > maxRequests) {
			return {
				success: false,
				remaining: 0,
				resetIn,
				retryAfter: resetIn,
			};
		}

		return {
			success: true,
			remaining: Math.max(0, maxRequests - count),
			resetIn,
		};
	} catch {
		return rateLimitInMemory(id, opts);
	}
}

export function clearRateLimit(identifier: string): void {
	rateLimitMap.delete(identifier);
}

export function getRateLimitStatus(identifier: string): RateLimitRecord | null {
	return rateLimitMap.get(identifier) ?? null;
}

// Clean up expired entries every 60 seconds
const cleanupInterval = setInterval(() => {
	const now = Date.now();
	let cleaned = 0;

	for (const [key, value] of rateLimitMap.entries()) {
		if (now > value.resetTime) {
			rateLimitMap.delete(key);
			cleaned++;
		}
	}

	if (cleaned > 0) {
		console.debug(`[RATE_LIMIT] Cleaned ${cleaned} expired entries`);
	}
}, 60000);

// Cleanup on process exit
process.on("exit", () => {
	clearInterval(cleanupInterval);
});

// Get current map size (for monitoring)
export function getRateLimitMapSize(): number {
	return rateLimitMap.size;
}
