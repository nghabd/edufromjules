const requiredEnvVars = [
	"DATABASE_URL",
	"NEXTAUTH_SECRET",
	"NEXTAUTH_URL",
] as const;

export function validateEnv() {
	const missing: string[] = [];

	for (const envVar of requiredEnvVars) {
		if (!process.env[envVar]) {
			missing.push(envVar);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}

	// Validate storage configuration if not local
	const storageProvider = process.env.STORAGE_PROVIDER || "local";
	if (storageProvider === "r2") {
		const r2Vars = [
			"CLOUDFLARE_ACCOUNT_ID",
			"CLOUDFLARE_R2_ACCESS_KEY_ID",
			"CLOUDFLARE_R2_SECRET_ACCESS_KEY",
			"CLOUDFLARE_R2_BUCKET",
		];
		for (const v of r2Vars) {
			if (!process.env[v]) missing.push(v);
		}
	} else if (storageProvider === "s3") {
		const s3Vars = [
			"AWS_REGION",
			"AWS_ACCESS_KEY_ID",
			"AWS_SECRET_ACCESS_KEY",
			"AWS_S3_BUCKET",
		];
		for (const v of s3Vars) {
			if (!process.env[v]) missing.push(v);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}

	return true;
}

export function getEnv() {
	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.NEXTAUTH_URL ||
		"http://localhost:3000";

	// Handle ALLOWED_ORIGINS - in production, default to the app URL if not set
	let allowedOrigins: string[];
	const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
	if (allowedOriginsEnv && allowedOriginsEnv.trim()) {
		allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim());
	} else {
		// In production, default to the app URL
		allowedOrigins = process.env.NODE_ENV === "production" ? [appUrl] : ["*"];
	}

	return {
		databaseUrl: process.env.DATABASE_URL!,
		databaseDirectUrl: process.env.DATABASE_DIRECT_URL,
		nextAuthSecret: process.env.NEXTAUTH_SECRET!,
		nextAuthUrl: process.env.NEXTAUTH_URL!,
		appUrl,
		googleClientId: process.env.GOOGLE_CLIENT_ID,
		googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
		nodeEnv: process.env.NODE_ENV || "development",
		allowedOrigins,
		redisUrl: process.env.REDIS_URL,
		storageProvider: (process.env.STORAGE_PROVIDER || "local") as
			| "local"
			| "r2"
			| "s3",
		hostname: process.env.HOSTNAME || "localhost",
		port: parseInt(process.env.PORT || "3003", 10),
		logLevel: (process.env.LOG_LEVEL || "info") as
			| "debug"
			| "info"
			| "warn"
			| "error",
		rateLimitWindowMs: parseInt(
			process.env.RATE_LIMIT_WINDOW_MS || "60000",
			10,
		),
		rateLimitMaxRequests: parseInt(
			process.env.RATE_LIMIT_MAX_REQUESTS || "100",
			10,
		),
		rateLimitStorageRequests: parseInt(
			process.env.RATE_LIMIT_STORAGE_ENDPOINT_REQUESTS || "50",
			10,
		),
	};
}

// Validate environment on import in production
if (process.env.NODE_ENV === "production") {
	validateEnv();
}
