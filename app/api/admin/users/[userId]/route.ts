import { NextResponse } from "next/server";
import { requireAdmin, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { adminUpdateUserSchema } from "@/lib/schemas";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
	// ... keep existing delete logic ...
	try {
		const originError = enforceTrustedOrigin(_req);
		if (originError) return originError;

		const { error, session } = await requireAdmin();
		if (error) return error;
		const { userId } = await context.params;
		if (userId === session.user.id)
			return badRequest("You cannot delete your own account.");

		await prisma.user.delete({ where: { id: userId } });
		await publishDashboardRefresh([
			REALTIME_EVENTS.adminChanged,
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
		]);
		return NextResponse.json(
			{ message: "User deleted successfully" },
			{ status: 200 },
		);
	} catch {
		return serverError("Failed to delete user");
	}
}

export async function PATCH(req: Request, context: RouteContext) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireAdmin();
		if (error) return error;

		const { userId } = await context.params;
		const body = await req.json().catch(() => null);
		const parsed = adminUpdateUserSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid user payload.", parsed.error.flatten());
		}

		const targetUser = await prisma.user.findUnique({ where: { id: userId } });
		if (!targetUser) return badRequest("User not found");
		if (targetUser.role === "ADMIN" && session.user.id !== userId)
			return badRequest("Cannot modify other admin accounts");
		if (session.user.id === userId && parsed.data.role !== "ADMIN") {
			return badRequest("You cannot remove your own admin access.");
		}

		if (parsed.data.role === "PHARMACIST" && parsed.data.supervisorId) {
			const supervisor = await prisma.user.findFirst({
				where: { id: parsed.data.supervisorId, role: "SUPERVISOR" },
				select: { id: true },
			});
			if (!supervisor) return badRequest("Selected supervisor was not found.");
		}

		const updatedUser = await prisma.user.update({
			where: { id: userId },
			data: {
				name: parsed.data.name || null,
				role: parsed.data.role,
				canApproveOnsiteTraining:
					parsed.data.role === "PHARMACIST"
						? parsed.data.canApproveOnsiteTraining
						: false,
				// Apply supervisor ID, or clear it if it's empty
				supervisorId:
					parsed.data.role === "PHARMACIST"
						? parsed.data.supervisorId || null
						: null,
			},
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				canApproveOnsiteTraining: true,
				supervisorId: true,
				updatedAt: true,
			},
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.adminChanged,
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
		]);

		return NextResponse.json(updatedUser, { status: 200 });
	} catch {
		return serverError("Failed to update user");
	}
}
