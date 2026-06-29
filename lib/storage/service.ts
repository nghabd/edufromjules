/**
 * Cloud Storage Service
 * Unified interface for Cloudflare R2, AWS S3, and local storage
 */

import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { logger } from "@/lib/logger";
import {
	getStorageConfigError,
	getStorageConfig,
	type StorageConfig,
} from "./config";

export interface UploadOptions {
	contentType: string;
	metadata?: Record<string, string>;
	isPublic?: boolean;
	expiresIn?: number;
}

export interface FileMetadata {
	key: string;
	size: number;
	contentType: string;
	uploadedAt: Date;
	url: string;
	storageProvider: StorageConfig["provider"];
}

export class StorageService {
	private config: StorageConfig;
	private s3Client: S3Client | null = null;

	constructor() {
		this.config = getStorageConfig();

		const configError = getStorageConfigError(this.config);
		if (configError) {
			throw new Error(configError);
		}

		if (this.config.provider !== "local") {
			const clientConfig: S3ClientConfig = {
				region: this.config.provider === "s3" ? this.config.region : "auto",
				credentials: {
					accessKeyId: this.config.accessKeyId,
					secretAccessKey: this.config.secretAccessKey,
				},
			};

			if (this.config.endpoint) {
				clientConfig.endpoint = this.config.endpoint;
			}

			this.s3Client = new S3Client(clientConfig);
		}
	}

	getProvider(): StorageConfig["provider"] {
		return this.config.provider;
	}

	isLocalProvider(): boolean {
		return this.config.provider === "local";
	}

	/**
	 * Generate unique file key with directory structure
	 */
	private generateFileKey(
		originalFilename: string,
		userId: string,
		category: string = "materials",
	): string {
		const parsedFilename = path.parse(originalFilename);
		const ext = parsedFilename.ext.toLowerCase();
		const timestamp = Date.now();
		const randomId = randomUUID().split("-")[0];
		const sanitizedName =
			(parsedFilename.name || "file")
			.replace(/[^a-z0-9.-]/gi, "_")
			.toLowerCase()
			.slice(0, 100) || "file";

		return `${category}/${userId}/${timestamp}-${randomId}-${sanitizedName}${ext}`;
	}

	private async streamToBuffer(stream: Readable): Promise<Buffer> {
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(
				Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
			);
		}
		return Buffer.concat(chunks);
	}

	/**
	 * Upload file to cloud storage
	 */
	async uploadFile(
		fileBuffer: Buffer | Readable,
		filename: string,
		userId: string,
		options: UploadOptions,
		category: string = "materials",
	): Promise<FileMetadata> {
		try {
			// Validate file type
			if (!this.config.allowedMimeTypes.includes(options.contentType)) {
				throw new Error(`File type ${options.contentType} not allowed`);
			}

			// Validate file size
			const size = Buffer.isBuffer(fileBuffer) ? fileBuffer.length : 0;
			if (size > this.config.maxFileSize) {
				throw new Error(
					`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
				);
			}

			const fileKey = this.generateFileKey(filename, userId, category);

			if (this.config.provider === "local") {
				return this.uploadLocal(fileBuffer, fileKey, options);
			}

			return this.uploadToCloud(fileBuffer, fileKey, options);
		} catch (error) {
			logger.error("[STORAGE_UPLOAD_ERROR]", {
				filename,
				userId,
				error: (error as Error).message,
				provider: this.config.provider,
			});
			throw error;
		}
	}

	/**
	 * Upload file locally
	 */
	private async uploadLocal(
		fileBuffer: Buffer | Readable,
		fileKey: string,
		options: UploadOptions,
	): Promise<FileMetadata> {
		const basePath = this.config.bucket;
		const filePath = path.join(basePath, fileKey);
		const dirPath = path.dirname(filePath);

		await fs.mkdir(dirPath, { recursive: true });

		if (Buffer.isBuffer(fileBuffer)) {
			await fs.writeFile(filePath, fileBuffer);
		} else {
			await fs.writeFile(filePath, await this.streamToBuffer(fileBuffer));
		}

		const stats = await fs.stat(filePath);

		return {
			key: fileKey,
			size: stats.size,
			contentType: options.contentType,
			uploadedAt: new Date(),
			url: `${this.config.publicUrl}/api/storage/download/${fileKey}`,
			storageProvider: this.config.provider,
		};
	}

	/**
	 * Upload file to cloud storage (S3 or R2)
	 */
	private async uploadToCloud(
		fileBuffer: Buffer | Readable,
		fileKey: string,
		options: UploadOptions,
	): Promise<FileMetadata> {
		if (!this.s3Client) {
			throw new Error("S3 client not initialized");
		}

		const buffer = Buffer.isBuffer(fileBuffer)
			? fileBuffer
			: await this.streamToBuffer(fileBuffer);

		const command = new PutObjectCommand({
			Bucket: this.config.bucket,
			Key: fileKey,
			Body: buffer,
			ContentType: options.contentType,
			Metadata: {
				...options.metadata,
				"uploaded-at": new Date().toISOString(),
			},
			...(options.isPublic &&
				this.config.provider === "s3" &&
				this.config.enablePublicRead && { ACL: "public-read" }),
		});

		await this.s3Client.send(command);

		let url = this.config.publicUrl
			? `${this.config.publicUrl}/${fileKey}`
			: `${this.config.endpoint}/${this.config.bucket}/${fileKey}`;

		// For private files, generate a signed URL
		if (!options.isPublic && this.s3Client) {
			const signedUrlCommand = new GetObjectCommand({
				Bucket: this.config.bucket,
				Key: fileKey,
			});
			url = await getSignedUrl(this.s3Client, signedUrlCommand, {
				expiresIn: options.expiresIn || 3600,
			});
		}

		return {
			key: fileKey,
			size: buffer.length,
			contentType: options.contentType,
			uploadedAt: new Date(),
			url,
			storageProvider: this.config.provider,
		};
	}

	/**
	 * Download file from storage
	 */
	async downloadFile(fileKey: string): Promise<Buffer> {
		try {
			if (this.config.provider === "local") {
				return this.downloadLocal(fileKey);
			}

			return this.downloadFromCloud(fileKey);
		} catch (error) {
			logger.error("[STORAGE_DOWNLOAD_ERROR]", {
				fileKey,
				error: (error as Error).message,
				provider: this.config.provider,
			});
			throw error;
		}
	}

	/**
	 * Download file from local storage
	 */
	private async downloadLocal(fileKey: string): Promise<Buffer> {
		const filePath = path.join(this.config.bucket, fileKey);

		// Security: Prevent directory traversal
		const resolvedPath = path.resolve(filePath);
		const resolvedBase = path.resolve(this.config.bucket);

		if (!resolvedPath.startsWith(resolvedBase)) {
			throw new Error("Invalid file path");
		}

		return fs.readFile(resolvedPath);
	}

	/**
	 * Download file from cloud storage
	 */
	private async downloadFromCloud(fileKey: string): Promise<Buffer> {
		if (!this.s3Client) {
			throw new Error("S3 client not initialized");
		}

		const command = new GetObjectCommand({
			Bucket: this.config.bucket,
			Key: fileKey,
		});

		const response = await this.s3Client.send(command);
		const body = response.Body as AsyncIterable<Uint8Array> | undefined;
		if (!body) {
			throw new Error("File body is empty");
		}

		const chunks: Uint8Array[] = [];

		for await (const chunk of body) {
			chunks.push(chunk);
		}

		return Buffer.concat(chunks);
	}

	/**
	 * Delete file from storage
	 */
	async deleteFile(fileKey: string): Promise<void> {
		try {
			if (this.config.provider === "local") {
				return this.deleteLocal(fileKey);
			}

			return this.deleteFromCloud(fileKey);
		} catch (error) {
			logger.error("[STORAGE_DELETE_ERROR]", {
				fileKey,
				error: (error as Error).message,
				provider: this.config.provider,
			});
			throw error;
		}
	}

	/**
	 * Delete file from local storage
	 */
	private async deleteLocal(fileKey: string): Promise<void> {
		const filePath = path.join(this.config.bucket, fileKey);

		// Security: Prevent directory traversal
		const resolvedPath = path.resolve(filePath);
		const resolvedBase = path.resolve(this.config.bucket);

		if (!resolvedPath.startsWith(resolvedBase)) {
			throw new Error("Invalid file path");
		}

		await fs.unlink(resolvedPath);
	}

	/**
	 * Delete file from cloud storage
	 */
	private async deleteFromCloud(fileKey: string): Promise<void> {
		if (!this.s3Client) {
			throw new Error("S3 client not initialized");
		}

		const command = new DeleteObjectCommand({
			Bucket: this.config.bucket,
			Key: fileKey,
		});

		await this.s3Client.send(command);
	}

	/**
	 * Get file metadata
	 */
	async getFileMetadata(fileKey: string): Promise<FileMetadata | null> {
		try {
			if (this.config.provider === "local") {
				return this.getLocalFileMetadata(fileKey);
			}

			return this.getCloudFileMetadata(fileKey);
		} catch (error) {
			logger.warn("[STORAGE_METADATA_ERROR]", {
				fileKey,
				error: (error as Error).message,
			});
			return null;
		}
	}

	/**
	 * Get local file metadata
	 */
	private async getLocalFileMetadata(
		fileKey: string,
	): Promise<FileMetadata | null> {
		const filePath = path.join(this.config.bucket, fileKey);

		// Security: Prevent directory traversal
		const resolvedPath = path.resolve(filePath);
		const resolvedBase = path.resolve(this.config.bucket);

		if (!resolvedPath.startsWith(resolvedBase)) {
			return null;
		}

		try {
			const stats = await fs.stat(resolvedPath);

			return {
				key: fileKey,
				size: stats.size,
				contentType: "application/octet-stream",
				uploadedAt: stats.birthtime,
				url: `${this.config.publicUrl}/api/storage/download/${fileKey}`,
				storageProvider: this.config.provider,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Get cloud file metadata
	 */
	private async getCloudFileMetadata(
		fileKey: string,
	): Promise<FileMetadata | null> {
		if (!this.s3Client) {
			return null;
		}

		const command = new HeadObjectCommand({
			Bucket: this.config.bucket,
			Key: fileKey,
		});

		const response = await this.s3Client.send(command);

		const url = this.config.publicUrl
			? `${this.config.publicUrl}/${fileKey}`
			: `${this.config.endpoint}/${this.config.bucket}/${fileKey}`;

		return {
			key: fileKey,
			size: response.ContentLength || 0,
			contentType: response.ContentType || "application/octet-stream",
			uploadedAt: response.LastModified || new Date(),
			url,
			storageProvider: this.config.provider,
		};
	}

	/**
	 * Generate signed URL for private files
	 */
	async generateSignedUrl(
		fileKey: string,
		expiresIn: number = 3600,
	): Promise<string> {
		if (this.config.provider === "local") {
			return `${this.config.publicUrl}/api/storage/download/${fileKey}`;
		}

		if (!this.s3Client) {
			throw new Error("S3 client not initialized");
		}

		const command = new GetObjectCommand({
			Bucket: this.config.bucket,
			Key: fileKey,
		});

		return getSignedUrl(this.s3Client, command, { expiresIn });
	}
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
	if (!storageServiceInstance) {
		storageServiceInstance = new StorageService();
	}
	return storageServiceInstance;
}
