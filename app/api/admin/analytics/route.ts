import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";

export async function GET() {
	try {
		const { error } = await requireAdmin();
		if (error) return error;

		const now = new Date();
		const thirtyDaysAgo = subDays(now, 30);

		const [
			totalUsers,
			usersByRole,
			totalCourses,
			totalAssignments,
			completedAssignments,
			overdueAssignments,
			totalCertificates,
			recentActivity,
			enrollmentsByDay,
			completionsByDay,
		] = await Promise.all([
			prisma.user.count(),
			prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
			prisma.course.count(),
			prisma.courseAssignment.count(),
			prisma.courseAssignment.count({ where: { status: "COMPLETED" } }),
			prisma.courseAssignment.count({
				where: {
					dueDate: { lt: now },
					status: { not: "COMPLETED" },
				},
			}),
			prisma.certificate.count(),
			prisma.notification.findMany({
				orderBy: { createdAt: "desc" },
				take: 20,
				include: { user: { select: { name: true, email: true, role: true } } },
			}),
			prisma.courseAssignment.groupBy({
				by: ["createdAt"],
				where: { createdAt: { gte: thirtyDaysAgo } },
				_count: { id: true },
				orderBy: { createdAt: "asc" },
			}),
			prisma.certificate.groupBy({
				by: ["issueDate"],
				where: { issueDate: { gte: thirtyDaysAgo } },
				_count: { id: true },
				orderBy: { issueDate: "asc" },
			}),
		]);

		// Build 30-day chart data
		const dayMap = new Map<string, { enrollments: number; completions: number }>();
		for (let i = 29; i >= 0; i--) {
			const d = startOfDay(subDays(now, i)).toISOString().slice(0, 10);
			dayMap.set(d, { enrollments: 0, completions: 0 });
		}
		for (const row of enrollmentsByDay) {
			const d = startOfDay(new Date(row.createdAt)).toISOString().slice(0, 10);
			if (dayMap.has(d)) dayMap.get(d)!.enrollments += row._count.id;
		}
		for (const row of completionsByDay) {
			const d = startOfDay(new Date(row.issueDate)).toISOString().slice(0, 10);
			if (dayMap.has(d)) dayMap.get(d)!.completions += row._count.id;
		}
		const chartData = Array.from(dayMap.entries()).map(([date, counts]) => ({
			date,
			...counts,
		}));

		const roleMap = Object.fromEntries(
			usersByRole.map((r) => [r.role, r._count.id]),
		);

		return NextResponse.json({
			stats: {
				totalUsers,
				admins: roleMap["ADMIN"] ?? 0,
				supervisors: roleMap["SUPERVISOR"] ?? 0,
				pharmacists: roleMap["PHARMACIST"] ?? 0,
				totalCourses,
				totalAssignments,
				completedAssignments,
				overdueAssignments,
				completionRate:
					totalAssignments > 0
						? Math.round((completedAssignments / totalAssignments) * 100)
						: 0,
				totalCertificates,
			},
			chartData,
			recentActivity,
		});
	} catch {
		return serverError("Failed to fetch analytics");
	}
}
