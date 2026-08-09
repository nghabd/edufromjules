import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireRole(["PHARMACIST", "SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const certificates = await prisma.certificate.findMany({
			where: { userId: session.user.id },
			orderBy: { issueDate: "desc" },
		});

		return NextResponse.json({ certificates });
	} catch {
		return serverError("Failed to fetch certificates");
	}
}

