import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { findAccessibleMaterial } from "@/lib/material-access";
import { logger } from "@/lib/logger";
import { getStorageService } from "@/lib/storage";

const mimeTypes: Record<string, string> = {
	PDF: "application/pdf",
	VIDEO: "video/mp4",
	DOCUMENT: "application/msword",
	PRESENTATION: "application/vnd.ms-powerpoint",
	IMAGE: "image/jpeg",
};

type RouteContext = {
	params: Promise<{ materialId: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
	try {
		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const { materialId } = await context.params;

		if (!materialId || !/^[a-z0-9]{24,}$/.test(materialId)) {
			logger.warn("[FILE_INVALID_ID]", { materialId, userId: session.user.id });
			return NextResponse.json(
				{ message: "Invalid material ID" },
				{ status: 400 },
			);
		}

		const material = await findAccessibleMaterial(
			materialId,
			session.user.id,
			session.user.role,
		);

		if (!material) {
			logger.warn("[FILE_NOT_FOUND]", { materialId, userId: session.user.id });
			return NextResponse.json(
				{ message: "Material not found or access denied" },
				{ status: 404 },
			);
		}

		const storageKey = material.storageKey || material.storagePath;
		if (!storageKey) {
			logger.warn("[FILE_NO_STORAGE_KEY]", {
				materialId,
				userId: session.user.id,
			});
			return NextResponse.json(
				{ message: "File not available" },
				{ status: 404 },
			);
		}

		if (storageKey.includes("..") || storageKey.startsWith("/")) {
			logger.error("[FILE_TRAVERSAL_ATTEMPT]", {
				materialId,
				userId: session.user.id,
				storageKey,
			});
			return NextResponse.json(
				{ message: "Invalid file path" },
				{ status: 400 },
			);
		}

		const storageService = getStorageService();
		const contentType =
			material.contentType ||
			mimeTypes[material.type] ||
			"application/octet-stream";
		const fileName = material.title
			.replace(/[^a-z0-9._-]/gi, "_")
			.slice(0, 255);

		logger.info("[FILE_REQUESTED]", {
			materialId,
			userId: session.user.id,
			type: material.type,
			provider: storageService.getProvider(),
		});

		if (!storageService.isLocalProvider()) {
			const signedUrl = await storageService.generateSignedUrl(storageKey, 3600);
			return NextResponse.redirect(signedUrl);
		}

		const fileBuffer = await storageService.downloadFile(storageKey);

		return new NextResponse(new Uint8Array(fileBuffer), {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": `inline; filename="${fileName}"`,
				"Content-Length": String(fileBuffer.length),
				"Cache-Control": "private, max-age=300",
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options": "DENY",
			},
		});
	} catch (error) {
		logger.error("[FILE_ERROR]", {
			error: (error as Error).message,
		});
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 },
		);
	}
}
