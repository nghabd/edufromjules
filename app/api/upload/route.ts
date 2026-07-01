import { NextResponse } from "next/server";
import { requireRole, badRequest } from "@/lib/api-auth";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { sanitizeFileName } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { getStorageService } from "@/lib/storage";
import { validateFileUpload } from "@/lib/validation";

const MIME_TO_MATERIAL_TYPE: Record<string, string> = {
	"application/pdf": "PDF",
	"video/mp4": "VIDEO",
	"video/quicktime": "VIDEO",
	"video/x-msvideo": "VIDEO",
	"image/jpeg": "IMAGE",
	"image/png": "IMAGE",
	"image/webp": "IMAGE",
	"image/gif": "IMAGE",
	"application/msword": "DOCUMENT",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"DOCUMENT",
	"text/plain": "DOCUMENT",
	"application/vnd.ms-powerpoint": "PRESENTATION",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation":
		"PRESENTATION",
};

const SUPPORTED_MATERIAL_TYPES = new Set([
	"PDF",
	"VIDEO",
	"IMAGE",
	"DOCUMENT",
	"PRESENTATION",
]);

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

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const formData = await req.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ message: "No file found" }, { status: 400 });
		}

		const requestedType = String(formData.get("type") || "").toUpperCase();
		const materialType = SUPPORTED_MATERIAL_TYPES.has(requestedType)
			? requestedType
			: MIME_TO_MATERIAL_TYPE[file.type];

		if (!materialType) {
			return badRequest("Unsupported file type.");
		}

		const fileValidation = validateFileUpload(file, materialType);
		if (!fileValidation.valid) {
			return badRequest(fileValidation.error || "Invalid file upload.");
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const safeFileName = sanitizeFileName(file.name);
		const storageService = getStorageService();
		const uploadedFile = await storageService.uploadFile(
			buffer,
			safeFileName,
			session.user.id,
			{
				contentType: file.type,
				metadata: {
					originalName: safeFileName,
					materialType,
					uploadedBy: session.user.id,
				},
				isPublic: false,
			},
			"course-materials",
		);

		return NextResponse.json(
			{
				url: uploadedFile.url,
				name: safeFileName,
				type: materialType,
				storageKey: uploadedFile.key,
				storagePath: uploadedFile.key,
				storageProvider: normalizeStorageProvider(uploadedFile.storageProvider),
				fileSize: uploadedFile.size,
				contentType: uploadedFile.contentType,
				uploadedAt: uploadedFile.uploadedAt.toISOString(),
			},
			{ status: 200 },
		);
	} catch (err) {
		logger.error("[UPLOAD_ERROR]", {
			error: (err as Error).message,
		});
		const message = getSafeUploadErrorMessage(err);
		return NextResponse.json(
			{ message },
			{ status: 500 },
		);
	}
}
