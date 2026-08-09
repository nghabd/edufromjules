/**
 * Media Metadata Extraction and Processing
 * Handles PDF, video, and image metadata extraction
 */

import { logger } from "@/lib/logger";

export interface MediaMetadata {
	type: "pdf" | "video" | "image" | "document" | "presentation";
	size: number;
	mimeType: string;
	duration?: number; // For video/audio in seconds
	width?: number; // For images/video in pixels
	height?: number; // For images/video in pixels
	pages?: number; // For PDF documents
	title?: string;
	author?: string;
	createdAt?: Date;
	modifiedAt?: Date;
	externalMetadata?: Record<string, unknown>;
}

export interface VideoMetadata extends MediaMetadata {
	type: "video";
	duration: number;
	width: number;
	height: number;
	frameRate?: number;
	bitrate?: number;
	videoCodec?: string;
	audioCodec?: string;
}

export interface ImageMetadata extends MediaMetadata {
	type: "image";
	width: number;
	height: number;
	colorSpace?: string;
	hasAlpha?: boolean;
	format?: string;
}

export interface PDFMetadata extends MediaMetadata {
	type: "pdf";
	pages: number;
	encrypted?: boolean;
	author?: string;
	creator?: string;
	title?: string;
	subject?: string;
	keywords?: string[];
}

/**
 * Extract metadata from buffer based on MIME type
 */
export async function extractMetadata(
	buffer: Buffer,
	mimeType: string,
	filename: string,
): Promise<MediaMetadata> {
	try {
		if (mimeType.startsWith("video/")) {
			return extractVideoMetadata(buffer, mimeType);
		}

		if (mimeType.startsWith("image/")) {
			return extractImageMetadata(buffer, mimeType);
		}

		if (mimeType === "application/pdf") {
			return extractPDFMetadata(buffer, mimeType);
		}

		// Fallback for documents
		return {
			type: "document",
			size: buffer.length,
			mimeType,
			modifiedAt: new Date(),
		};
	} catch (error) {
		logger.warn("[METADATA_EXTRACTION_ERROR]", {
			filename,
			mimeType,
			error: (error as Error).message,
		});

		return {
			type: "document",
			size: buffer.length,
			mimeType,
			modifiedAt: new Date(),
		};
	}
}

/**
 * Extract video metadata
 */
function extractVideoMetadata(
	buffer: Buffer,
	mimeType: string,
): VideoMetadata {
	// Parse basic MP4/WebM metadata from buffer
	// For production, use ffprobe or similar tool

	// Simple heuristic: extract dimensions if available in buffer
	let width = 1920;
	let height = 1080;
	const duration = 0;

	// Look for common video headers
	if (mimeType === "video/mp4") {
		// Basic MP4 dimension extraction (simplified)
		const widthIndex = buffer.indexOf(Buffer.from("mvhd")) + 36;
		const heightIndex = widthIndex + 4;

		if (widthIndex > 0) {
			width = buffer.readUInt32BE(widthIndex) >> 16;
			height = buffer.readUInt32BE(heightIndex) >> 16;
		}
	}

	return {
		type: "video",
		size: buffer.length,
		mimeType,
		duration,
		width,
		height,
		frameRate: 30,
		bitrate: duration > 0 ? Math.floor((buffer.length * 8) / duration) : 5000000,
		videoCodec: mimeType === "video/mp4" ? "h264" : "vp9",
		audioCodec: "aac",
		modifiedAt: new Date(),
	};
}

/**
 * Extract image metadata
 */
function extractImageMetadata(
	buffer: Buffer,
	mimeType: string,
): ImageMetadata {
	let width = 1920;
	let height = 1080;
	let format = "jpeg";
	let hasAlpha = false;

	// Parse JPEG
	if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
		const metadata = parseJPEGMetadata(buffer);
		width = metadata.width;
		height = metadata.height;
		format = "jpeg";
	}
	// Parse PNG
	else if (mimeType === "image/png") {
		const metadata = parsePNGMetadata(buffer);
		width = metadata.width;
		height = metadata.height;
		hasAlpha = metadata.hasAlpha;
		format = "png";
	}
	// Parse WebP
	else if (mimeType === "image/webp") {
		const metadata = parseWebPMetadata(buffer);
		width = metadata.width;
		height = metadata.height;
		hasAlpha = metadata.hasAlpha;
		format = "webp";
	}

	return {
		type: "image",
		size: buffer.length,
		mimeType,
		width,
		height,
		colorSpace: "rgb",
		hasAlpha,
		format,
		modifiedAt: new Date(),
	};
}

/**
 * Parse JPEG metadata
 */
function parseJPEGMetadata(buffer: Buffer): { width: number; height: number } {
	if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
		return { width: 1920, height: 1080 };
	}

	let pos = 2;
	while (pos < buffer.length) {
		if (buffer[pos] !== 0xff) break;

		const marker = buffer[pos + 1];
		const length = buffer.readUInt16BE(pos + 2);

		// Start of Frame markers (0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCE)
		if (
			(marker & 0xf0) === 0xc0 &&
			marker !== 0xc4 &&
			marker !== 0xc8 &&
			marker !== 0xcc
		) {
			const height = buffer.readUInt16BE(pos + 5);
			const width = buffer.readUInt16BE(pos + 7);
			return { width, height };
		}

		pos += length + 2;
	}

	return { width: 1920, height: 1080 };
}

/**
 * Parse PNG metadata
 */
function parsePNGMetadata(buffer: Buffer): {
	width: number;
	height: number;
	hasAlpha: boolean;
} {
	if (
		buffer[0] !== 0x89 ||
		buffer[1] !== 0x50 ||
		buffer[2] !== 0x4e ||
		buffer[3] !== 0x47
	) {
		return { width: 1920, height: 1080, hasAlpha: false };
	}

	// IHDR chunk is always first
	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);
	const colorType = buffer[25];

	// Color type 6 has alpha channel (RGBA)
	const hasAlpha = colorType === 6 || colorType === 4;

	return { width, height, hasAlpha };
}

/**
 * Parse WebP metadata
 */
function parseWebPMetadata(buffer: Buffer): {
	width: number;
	height: number;
	hasAlpha: boolean;
} {
	if (
		buffer[0] !== 0x52 || // R
		buffer[1] !== 0x49 || // I
		buffer[2] !== 0x46 || // F
		buffer[3] !== 0x46 || // F
		buffer[8] !== 0x57 || // W
		buffer[9] !== 0x45 || // E
		buffer[10] !== 0x42 || // B
		buffer[11] !== 0x50 // P
	) {
		return { width: 1920, height: 1080, hasAlpha: false };
	}

	let pos = 12;
	while (pos < buffer.length) {
		const chunkId = buffer.toString("ascii", pos, pos + 4);
		const chunkSize = buffer.readUInt32LE(pos + 4);

		if (chunkId === "VP8L") {
			// Lossless WebP with potential alpha
			const bits = buffer.readUInt32LE(pos + 8);
			const width = ((bits & 0x3f) + 1) << 0;
			const height = (((bits >> 8) & 0x3f) + 1) << 0;
			return { width, height, hasAlpha: true };
		}

		if (chunkId === "VP8 ") {
			// Lossy WebP
			const frame = buffer.readUInt16LE(pos + 10);
			const width = (frame & 0x3fff) + 1;
			const height = ((frame >> 14) & 0x3fff) + 1;
			return { width, height, hasAlpha: false };
		}

		pos += 8 + chunkSize;
	}

	return { width: 1920, height: 1080, hasAlpha: false };
}

/**
 * Extract PDF metadata
 */
function extractPDFMetadata(
	buffer: Buffer,
	mimeType: string,
): PDFMetadata {
	let pages = 0;
	let encrypted = false;

	// Simple heuristic: count page objects
	const pagePattern = /\/Type\s*\/Page[^s]/g;
	const matches = buffer.toString("binary").match(pagePattern);
	pages = matches ? matches.length : 1;

	// Check for encryption
	if (buffer.indexOf(Buffer.from("/Encrypt")) !== -1) {
		encrypted = true;
	}

	return {
		type: "pdf",
		size: buffer.length,
		mimeType,
		pages: Math.max(pages, 1),
		encrypted,
		modifiedAt: new Date(),
	};
}

/**
 * Generate thumbnail metadata for images
 */
export function generateThumbnailMetadata(
	originalMetadata: ImageMetadata,
	thumbnailSize: "sm" | "md" | "lg" = "md",
): ImageMetadata {
	const sizes = {
		sm: { width: 150, height: 150 },
		md: { width: 300, height: 300 },
		lg: { width: 600, height: 600 },
	};

	const size = sizes[thumbnailSize];
	const aspectRatio = originalMetadata.width / originalMetadata.height;

	return {
		...originalMetadata,
		width: Math.min(size.width, originalMetadata.width),
		height: Math.min(
			Math.round(size.width / aspectRatio),
			originalMetadata.height,
		),
	};
}
