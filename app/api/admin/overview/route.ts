import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { courseResponseInclude } from "@/lib/course-include";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		console.log("[ADMIN_OVERVIEW] Fetching overview data...");
		const { error, session } = await requireAdmin();
		if (error) {
			console.warn("[ADMIN_OVERVIEW] Unauthorized access attempt", { error });
			return error;
		}

		console.log("[ADMIN_OVERVIEW] Fetching from DB...", { userId: session.user.id });

		const [users, courses] = await Promise.all([
			prisma.user.findMany({
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					canApproveOnsiteTraining: true,
					supervisorId: true,
					supervisor: { select: { name: true, email: true } },
					createdAt: true,
				},
				orderBy: { createdAt: "desc" },
				take: 200,
			}),
			prisma.course.findMany({
				include: courseResponseInclude,
				orderBy: { createdAt: "desc" },
				take: 100,
			}),
		]);

		console.log("[ADMIN_OVERVIEW] Success", { userCount: users.length, courseCount: courses.length });
		return NextResponse.json({ users, courses });
	} catch (err) {
		console.error("[ADMIN_OVERVIEW] ERROR", err);
		return serverError("Failed to fetch admin overview");
	}
}
