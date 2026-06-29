/**
 * Storage Module
 * Exports storage service and utilities
 */

export { getStorageService, StorageService } from "./service";
export type { FileMetadata, UploadOptions } from "./service";
export {
	getStorageConfig,
	getStorageConfigError,
	validateStorageConfig,
} from "./config";
export type { StorageConfig, S3Config, R2Config } from "./config";
export {
	extractMetadata,
	generateThumbnailMetadata,
	type MediaMetadata,
	type VideoMetadata,
	type ImageMetadata,
	type PDFMetadata,
} from "./metadata";
