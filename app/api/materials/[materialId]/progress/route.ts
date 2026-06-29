import { NextResponse } from "next/server";
import { requireRole, serverError, badRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const progressUpdateSchema = z.object({
	timeSpent: z.number().int().min(0).max(86400), // max 24 hours
	progress: z.number().min(0).max(100).optional(),
});

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ materialId: string }> },
) {
	try {
		const { error, session } = await requireRole([
			"PHARMACIST",
			"SUPERVISOR",
			"ADMIN",
		]);
		if (error) return error;

		const { materialId } = await params;
		const body = await req.json().catch(() => null);
		const parsed = progressUpdateSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest("Invalid progress data");
		}

		const { timeSpent, progress } = parsed.data;

		// Verify material exists
		const material = await prisma.material.findUnique({
			where: { id: materialId },
			select: { id: true },
		});
		if (!material) {
			return NextResponse.json({ message: "Material not found" }, { status: 404 });
		}

		// Update or create user progress
		const updated = await prisma.userProgress.upsert({
			where: {
				userId_materialId: {
					userId: session.user.id,
					materialId,
				},
			},
			update: {
				timeSpent: { increment: timeSpent },
				...(progress !== undefined && { progress }),
			},
			create: {
				userId: session.user.id,
				materialId,
				timeSpent,
				...(progress !== undefined && { progress }),
			},
		});

		return NextResponse.json({ success: true, timeSpent: updated.timeSpent });
	} catch {
		return serverError("Failed to update progress");
	}
}
