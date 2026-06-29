import { NextResponse } from "next/server";
import { requireRole, serverError, badRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { z } from "zod";

const profileUpdateSchema = z.object({
	name: z.string().trim().min(2).max(100).optional(),
	phoneNumber: z.string().trim().max(30).optional().nullable(),
	licenseNumber: z.string().trim().max(100).optional().nullable(),
	specialization: z.string().trim().max(200).optional().nullable(),
	yearsOfExperience: z.coerce.number().int().min(0).max(60).optional().nullable(),
	pharmacyName: z.string().trim().max(200).optional().nullable(),
	address: z.string().trim().max(500).optional().nullable(),
	bio: z.string().trim().max(1000).optional().nullable(),
});

export async function GET() {
	try {
		const { error, session } = await requireRole(["ADMIN", "SUPERVISOR", "PHARMACIST"]);
		if (error) return error;

		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				createdAt: true,
				profile: true,
				_count: {
					select: {
						certificates: true,
						quizAttempts: true,
					},
				},
			},
		});

		if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

		return NextResponse.json({ user });
	} catch {
		return serverError("Failed to fetch profile");
	}
}

export async function PATCH(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["ADMIN", "SUPERVISOR", "PHARMACIST"]);
		if (error) return error;

		const body = await req.json().catch(() => null);
		const parsed = profileUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid profile data", { errors: parsed.error.flatten() });
		}

		const { name, ...profileFields } = parsed.data;

		// Update user name if provided
		if (name !== undefined) {
			await prisma.user.update({
				where: { id: session.user.id },
				data: { name },
			});
		}

		// Upsert profile
		await prisma.profile.upsert({
			where: { userId: session.user.id },
			update: profileFields,
			create: { userId: session.user.id, ...profileFields },
		});

		return NextResponse.json({ success: true });
	} catch {
		return serverError("Failed to update profile");
	}
}
