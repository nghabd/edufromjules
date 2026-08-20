import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const trainers = await prisma.user.findMany({
			where: {
				role: "PHARMACIST",
				canApproveOnsiteTraining: true,
			},
			select: {
				id: true,
				name: true,
				email: true,
			},
			orderBy: { name: "asc" },
		});

		return NextResponse.json(trainers);
	} catch {
		return serverError("Failed to fetch trainers");
	}
}