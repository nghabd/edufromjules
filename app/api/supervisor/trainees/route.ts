import { NextResponse } from "next/server";
import { requireRole, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export async function GET() {
	try {
		const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		// Fetch pharmacists who DO NOT have a supervisor yet
		const unassignedPharmacists = await prisma.user.findMany({
			where: { role: "PHARMACIST", supervisorId: null },
			select: { id: true, name: true, email: true },
		});

		return NextResponse.json(unassignedPharmacists);
	} catch {
		return serverError("Failed to fetch pharmacists");
	}
}

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const { pharmacistId } = await req.json();
		if (!pharmacistId) return badRequest("Pharmacist ID required");

		const pharmacist = await prisma.user.findFirst({
			where: { id: pharmacistId, role: "PHARMACIST", supervisorId: null },
			select: { id: true },
		});
		if (!pharmacist) return badRequest("Pharmacist is not available.");

		await prisma.user.update({
			where: { id: pharmacistId },
			data: { supervisorId: session.user.id },
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.adminChanged,
		]);

		return NextResponse.json({ message: "Pharmacist added to group" });
	} catch {
		return serverError("Failed to add pharmacist");
	}
}

export async function PATCH(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const { pharmacistId } = await req.json();
		if (!pharmacistId) return badRequest("Pharmacist ID required");

		const pharmacist = await prisma.user.findFirst({
			where: {
				id: pharmacistId,
				role: "PHARMACIST",
				...(session.user.role === "SUPERVISOR"
					? { supervisorId: session.user.id }
					: {}),
			},
			select: { id: true },
		});
		if (!pharmacist) return badRequest("Pharmacist is not in your group.");

		await prisma.user.update({
			where: { id: pharmacistId },
			data: { supervisorId: null },
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.adminChanged,
		]);

		return NextResponse.json({ message: "Pharmacist removed from group" });
	} catch {
		return serverError("Failed to remove pharmacist");
	}
}
