/**
 * Cloud Storage Configuration
 * Supports Cloudflare R2 and AWS S3
 */

export interface StorageConfig {
	provider: "r2" | "s3" | "local";
	accountId?: string;
	endpoint?: string;
	region?: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	publicUrl: string;
	maxFileSize: number;
	allowedMimeTypes: string[];
	enablePublicRead: boolean;
}

export interface S3Config extends StorageConfig {
	provider: "s3";
	region: string;
	endpoint: string;
}

export interface R2Config extends StorageConfig {
	provider: "r2";
	endpoint: string;
	accountId: string;
}

/**
 * Parse storage configuration from environment variables
 */
const DEFAULT_ALLOWED_MIME_TYPES = [
	"application/pdf",
	"video/mp4",
	"video/quicktime",
	"video/x-msvideo",
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/plain",
].join(",");

function parseAllowedMimeTypes() {
	return (process.env.STORAGE_ALLOWED_MIMES || DEFAULT_ALLOWED_MIME_TYPES)
		.split(",")
		.map((mimeType) => mimeType.trim())
		.filter(Boolean);
}

function parseMaxFileSize() {
	return parseInt(process.env.STORAGE_MAX_FILE_SIZE || "524288000", 10);
}

export function getStorageConfig(): StorageConfig {
	const provider = (process.env.STORAGE_PROVIDER || "local") as
		| "r2"
		| "s3"
		| "local";

	if (provider === "local") {
		return {
			provider: "local",
			accessKeyId: "",
			secretAccessKey: "",
			bucket: process.env.STORAGE_LOCAL_PATH || "./storage",
			publicUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
			maxFileSize: parseMaxFileSize(),
			allowedMimeTypes: parseAllowedMimeTypes(),
			enablePublicRead: false,
		};
	}

	if (provider === "r2") {
		return {
			provider: "r2",
			accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
			endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
			secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
			bucket: process.env.CLOUDFLARE_R2_BUCKET || "",
			publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
			maxFileSize: parseMaxFileSize(),
			allowedMimeTypes: parseAllowedMimeTypes(),
			enablePublicRead: process.env.CLOUDFLARE_R2_PUBLIC_READ === "true",
		};
	}

	// AWS S3
	return {
		provider: "s3",
		region: process.env.AWS_REGION || "us-east-1",
		endpoint: process.env.AWS_S3_ENDPOINT,
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
		bucket: process.env.AWS_S3_BUCKET || "",
		publicUrl: process.env.AWS_S3_PUBLIC_URL || "",
		maxFileSize: parseMaxFileSize(),
		allowedMimeTypes: parseAllowedMimeTypes(),
		enablePublicRead: process.env.AWS_S3_PUBLIC_READ === "true",
	};
}

/**
 * Validate storage configuration
 */
export function getStorageConfigError(config: StorageConfig): string | null {
	if (config.provider === "local") {
		return config.bucket ? null : "Local storage path is not configured";
	}

	if (config.provider === "r2") {
		if (!config.accountId) return "Cloudflare account ID is not configured";
		if (!config.accessKeyId) return "Cloudflare R2 access key ID is not configured";
		if (!config.secretAccessKey) {
			return "Cloudflare R2 secret access key is not configured";
		}
		if (!config.bucket) return "Cloudflare R2 bucket is not configured";
		if (!config.endpoint) return "Cloudflare R2 endpoint is not configured";
		if (config.accessKeyId.length !== 32) {
			return "Cloudflare R2 access key ID appears invalid. Use the R2 S3 API access key ID, not a Cloudflare API token.";
		}
		return null;
	}

	if (config.provider === "s3") {
		if (!config.accessKeyId) return "AWS access key ID is not configured";
		if (!config.secretAccessKey) return "AWS secret access key is not configured";
		if (!config.bucket) return "AWS S3 bucket is not configured";
		if (!config.region) return "AWS region is not configured";
		return null;
	}

	return "Unknown storage provider";
}

export function validateStorageConfig(config: StorageConfig): boolean {
	return getStorageConfigError(config) === null;
}
