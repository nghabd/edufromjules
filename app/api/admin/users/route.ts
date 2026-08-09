import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { adminCreateUserSchema } from "@/lib/schemas";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error } = await requireAdmin();
		if (error) return error;

		const body = await req.json().catch(() => null);
		const parsed = adminCreateUserSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid user payload.", parsed.error.flatten());
		}

		const {
			name,
			email,
			password,
			role,
			canApproveOnsiteTraining,
			supervisorId,
		} = parsed.data;

		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) return badRequest("A user with this email already exists");

		if (role === "PHARMACIST" && supervisorId) {
			const supervisor = await prisma.user.findFirst({
				where: { id: supervisorId, role: "SUPERVISOR" },
				select: { id: true },
			});
			if (!supervisor) return badRequest("Selected supervisor was not found.");
		}

		const hashedPassword = await bcrypt.hash(password, 12);

		const newUser = await prisma.user.create({
			data: {
				name: name || null,
				email,
				password: hashedPassword,
				role,
				canApproveOnsiteTraining:
					role === "PHARMACIST" ? canApproveOnsiteTraining : false,
				// Only assign a supervisor if the role is Pharmacist
				supervisorId: role === "PHARMACIST" ? supervisorId || null : null,
			},
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				canApproveOnsiteTraining: true,
				supervisorId: true,
				createdAt: true,
			},
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.adminChanged,
			REALTIME_EVENTS.supervisorChanged,
		]);

		return NextResponse.json(newUser, { status: 201 });
	} catch {
		return serverError("Failed to create user");
	}
}
