import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { courseResponseInclude } from "@/lib/course-payload";

export async function GET() {
	try {
		const { error } = await requireAdmin();
		if (error) return error;

		const users = await prisma.user.findMany({
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				canApproveOnsiteTraining: true,
				supervisorId: true,
				supervisor: { select: { name: true, email: true } }, // Fetch supervisor details
			},
			orderBy: { createdAt: "desc" },
		});

		const courses = await prisma.course.findMany({
			include: courseResponseInclude,
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json({ users, courses });
	} catch {
		return serverError("Failed to fetch admin overview");
	}
}
