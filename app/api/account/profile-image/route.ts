import { NextResponse } from "next/server";
import { badRequest, requireRole, serverError } from "@/lib/api-auth";
import { getAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";

const MAX_PROFILE_IMAGE_BYTES = 1_000_000;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);

export async function PATCH(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const formData = await req.formData();
		const remove = formData.get("remove") === "true";

		if (remove) {
			await prisma.user.update({
				where: { id: session.user.id },
				data: { image: null },
			});

			return NextResponse.json({ image: null });
		}

		const file = formData.get("image");
		if (!(file instanceof File)) {
			return badRequest("Profile image is required.");
		}

		if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
			return badRequest("Use a JPG, PNG, WebP, or GIF image.");
		}

		if (file.size <= 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
			return badRequest("Profile image must be smaller than 1 MB.");
		}

		const bytes = Buffer.from(await file.arrayBuffer());
		const image = `data:${file.type};base64,${bytes.toString("base64")}`;

		await prisma.user.update({
			where: { id: session.user.id },
			data: { image },
		});

		return NextResponse.json({
			image: `${getAvatarUrl(session.user.id, image)}?v=${Date.now()}`,
		});
	} catch (error) {
		console.error("[PROFILE_IMAGE_ERROR]", error);
		return serverError("Profile image could not be updated.");
	}
}
