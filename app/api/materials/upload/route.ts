/**
 * Material Upload API Route
 * Handles secure file uploads to Cloudflare R2, AWS S3, or local storage
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStorageService } from "@/lib/storage";
import { extractMetadata } from "@/lib/storage/metadata";
import { validateFileUpload } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { z } from "zod";

const uploadSchema = z.object({
	topicId: z.string().cuid("Invalid topic ID"),
	title: z.string().min(1).max(255),
	type: z.enum(["PDF", "VIDEO", "IMAGE", "DOCUMENT", "PRESENTATION"]),
	order: z.number().int().min(0),
	gateQuestion: z.string().optional(),
	gateAnswer: z.string().optional(),
});

type RouteContext = {
	params: Promise<{ materialId?: string }>;
};

function normalizeStorageProvider(provider: string) {
	if (provider === "r2") return "CLOUDFLARE";
	if (provider === "s3") return "S3";
	return "LOCAL";
}

function getSafeUploadErrorMessage(error: unknown) {
	const message = error instanceof Error ? error.message : "";
	if (
		message.includes("not configured") ||
		message.includes("appears invalid") ||
		message.includes("not allowed") ||
		message.includes("File size exceeds")
	) {
		return message;
	}

	if (
		message.includes("AccessDenied") ||
		message.includes("InvalidAccessKeyId") ||
		message.includes("SignatureDoesNotMatch") ||
		message.includes("Credential access key")
	) {
		return "Storage rejected the upload. Check the storage provider credentials and bucket permissions.";
	}

	return "Failed to upload file";
}

/**
 * POST: Upload new material
 */
export async function POST(req: NextRequest) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		// Rate limiting for uploads
		const rateLimitResult = await rateLimit(req, "storage-upload");
		if (!rateLimitResult.success) {
			return NextResponse.json(
				{ message: "Rate limit exceeded" },
				{ status: 429 },
			);
		}

		// Authentication
		const { error, session } = await requireRole(["ADMIN", "SUPERVISOR"]);
		if (error) return error;

		// Check authorization for topic
		const formData = await req.formData();
		const topicIdRaw = formData.get("topicId");
		const titleRaw = formData.get("title");
		const typeRaw = formData.get("type");
		const orderRaw = formData.get("order");
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json(
				{ message: "No file provided" },
				{ status: 400 },
			);
		}

		// Validate input
		let validatedInput;
		try {
			validatedInput = uploadSchema.parse({
				topicId: topicIdRaw,
				title: titleRaw,
				type: typeRaw,
				order: Number(orderRaw),
			});
		} catch (error) {
			logger.warn("[UPLOAD_VALIDATION_ERROR]", {
				userId: session.user.id,
				error: (error as Error).message,
			});
			return NextResponse.json(
				{ message: "Invalid input parameters" },
				{ status: 400 },
			);
		}

		// Verify topic exists and user has access
		const topic = await prisma.topic.findUnique({
			where: { id: validatedInput.topicId },
			select: {
				id: true,
				courseId: true,
				course: {
					select: {
						id: true,
						groups: {
							select: { id: true, supervisorId: true },
						},
					},
				},
			},
		});

		if (!topic) {
			return NextResponse.json({ message: "Topic not found" }, { status: 404 });
		}

		// Authorization: Verify supervisor owns the group managing this course
		const canAccess = topic.course.groups.some(
			(group) => group.supervisorId === session.user.id,
		);

		if (!canAccess && session.user.role !== "ADMIN") {
			logger.warn("[UPLOAD_UNAUTHORIZED]", {
				userId: session.user.id,
				topicId: validatedInput.topicId,
			});
			return NextResponse.json({ message: "Access denied" }, { status: 403 });
		}

		// Validate file
		const fileValidation = validateFileUpload(file, validatedInput.type);
		if (!fileValidation.valid) {
			return NextResponse.json(
				{ message: fileValidation.error },
				{ status: 400 },
			);
		}

		// Convert file to buffer
		const buffer = Buffer.from(await file.arrayBuffer());

		// Extract metadata
		const metadata = await extractMetadata(buffer, file.type, file.name);

		// Upload to storage
		const storageService = getStorageService();
		let fileMetadata;
		try {
			fileMetadata = await storageService.uploadFile(
				buffer,
				file.name,
				session.user.id,
				{
					contentType: file.type,
					metadata: {
						title: validatedInput.title,
						uploadedBy: session.user.id,
						type: validatedInput.type,
					},
					isPublic: false,
				},
				"course-materials",
			);
		} catch (storageError) {
			logger.error("[UPLOAD_STORAGE_ERROR]", {
				userId: session.user.id,
				error: (storageError as Error).message,
			});
			return NextResponse.json(
				{ message: getSafeUploadErrorMessage(storageError) },
				{ status: 500 },
			);
		}

		// Create material record in database
		try {
			const material = await prisma.$transaction(async (tx) => {
				const newMaterial = await tx.material.create({
					data: {
						type: validatedInput.type,
						title: validatedInput.title,
						url: fileMetadata.url,
						storageProvider: normalizeStorageProvider(
							fileMetadata.storageProvider,
						),
						storagePath: fileMetadata.key,
						order: validatedInput.order,
						topicId: validatedInput.topicId,
						fileSize: fileMetadata.size,
						contentType: file.type,
						storageKey: fileMetadata.key,
						uploadedAt: fileMetadata.uploadedAt,
						gateQuestion: formData.get("gateQuestion") as string | null,
						gateAnswer: formData.get("gateAnswer") as string | null,
					},
				});

				// Create metadata record
				await tx.mediaMetadata.create({
					data: {
						materialId: newMaterial.id,
						fileSize: fileMetadata.size,
						contentType: file.type,
						storageKey: fileMetadata.key,
						width: metadata.type === "image" ? metadata.width : undefined,
						height: metadata.type === "image" ? metadata.height : undefined,
						duration: metadata.type === "video" ? metadata.duration : undefined,
						pages: metadata.type === "pdf" ? metadata.pages : undefined,
						title: validatedInput.title,
						format:
							typeof (metadata as { format?: unknown }).format === "string"
								? (metadata as { format?: string }).format
								: undefined,
					},
				});

				return newMaterial;
			});

			logger.info("[MATERIAL_UPLOADED]", {
				materialId: material.id,
				userId: session.user.id,
				size: fileMetadata.size,
				type: validatedInput.type,
			});

			return NextResponse.json(
				{
					message: "Material uploaded successfully",
					material: {
						id: material.id,
						title: material.title,
						type: material.type,
						url: material.url,
						size: material.fileSize,
					},
				},
				{ status: 201 },
			);
		} catch (dbError) {
			logger.error("[MATERIAL_CREATE_ERROR]", {
				userId: session.user.id,
				error: (dbError as Error).message,
			});

			// Attempt to clean up uploaded file
			try {
				await storageService.deleteFile(fileMetadata.key);
			} catch (cleanupError) {
				logger.error("[CLEANUP_ERROR]", {
					fileKey: fileMetadata.key,
					error: (cleanupError as Error).message,
				});
			}

			return NextResponse.json(
				{ message: "Failed to save material" },
				{ status: 500 },
			);
		}
	} catch (error) {
		logger.error("[UPLOAD_ERROR]", {
			error: (error as Error).message,
			url: req.url,
		});
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * GET: Download material or get download URL
 */
export async function GET(req: NextRequest, context: RouteContext) {
	try {
		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const params = await context.params;
		const materialId = params.materialId;

		if (!materialId) {
			return NextResponse.json(
				{ message: "Material ID required" },
				{ status: 400 },
			);
		}

		// Find material with access control
		const material = await prisma.material.findUnique({
			where: { id: materialId },
			select: {
				id: true,
				title: true,
				storageKey: true,
				fileSize: true,
				contentType: true,
				topic: {
					select: {
						courseId: true,
						course: {
							select: {
								groups: {
									select: { pharmacists: { select: { id: true } } },
								},
							},
						},
					},
				},
			},
		});

		if (!material || !material.storageKey) {
			logger.warn("[MATERIAL_NOT_FOUND]", {
				materialId,
				userId: session.user.id,
			});
			return NextResponse.json(
				{ message: "Material not found" },
				{ status: 404 },
			);
		}

		// Verify access based on role
		let hasAccess =
			session.user.role === "ADMIN" || session.user.role === "SUPERVISOR";

		if (!hasAccess && session.user.role === "PHARMACIST") {
			// Check if pharmacist is in the course's group
			const pharmacistIds = material.topic.course.groups.flatMap((g) =>
				g.pharmacists.map((p) => p.id),
			);
			hasAccess = pharmacistIds.includes(session.user.id);
		}

		if (!hasAccess) {
			logger.warn("[MATERIAL_ACCESS_DENIED]", {
				materialId,
				userId: session.user.id,
			});
			return NextResponse.json({ message: "Access denied" }, { status: 403 });
		}

		// Log access
		await prisma.mediaAccess
			.create({
				data: {
					materialId,
					userId: session.user.id,
					accessType: "DOWNLOAD",
					userAgent: req.headers.get("user-agent") || undefined,
				},
			})
			.catch((err) =>
				logger.error("[MEDIA_ACCESS_LOG_ERROR]", {
					error: (err as Error).message,
				}),
			);

		// Get download URL (signed URL for private files)
		const storageService = getStorageService();
		let url: string;

		try {
			url = await storageService.generateSignedUrl(material.storageKey, 3600);
		} catch (error) {
			logger.error("[DOWNLOAD_URL_ERROR]", {
				materialId,
				error: (error as Error).message,
			});
			return NextResponse.json(
				{ message: "Failed to generate download URL" },
				{ status: 500 },
			);
		}

		logger.info("[MATERIAL_DOWNLOAD_URL_GENERATED]", {
			materialId,
			userId: session.user.id,
		});

		return NextResponse.json({
			message: "Download URL generated",
			downloadUrl: url,
			material: {
				id: material.id,
				title: material.title,
				size: material.fileSize,
				contentType: material.contentType,
			},
		});
	} catch (error) {
		logger.error("[DOWNLOAD_ERROR]", {
			error: (error as Error).message,
		});
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}
