import { NextResponse } from "next/server";
import { requireSupervisor, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireSupervisor();
		if (error) return error;

		const supervisorId = session.user.id;

		// Get all pharmacists under this supervisor
		const pharmacists = await prisma.user.findMany({
			where: {
				role: "PHARMACIST",
				OR: [
					{ supervisorId },
					{ group: { supervisorId } },
				],
			},
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true,
				courseAssignments: {
					select: {
						id: true,
						status: true,
						dueDate: true,
						course: { select: { id: true, title: true } },
					},
				},
				quizAttempts: {
					select: { score: true, passed: true, completedAt: true },
					orderBy: { startedAt: "desc" },
					take: 50,
				},
				certificates: {
					select: { id: true, courseName: true, issueDate: true },
				},
			},
		});

		const now = new Date();

		const pharmacistStats = pharmacists.map((p) => {
			const total = p.courseAssignments.length;
			const completed = p.courseAssignments.filter(
				(a) => a.status === "COMPLETED",
			).length;
			const overdue = p.courseAssignments.filter(
				(a) =>
					a.dueDate && new Date(a.dueDate) < now && a.status !== "COMPLETED",
			).length;
			const avgScore =
				p.quizAttempts.length > 0
					? Math.round(
							p.quizAttempts.reduce((s, a) => s + a.score, 0) /
								p.quizAttempts.length,
						)
					: null;

			return {
				id: p.id,
				name: p.name,
				email: p.email,
				joinedAt: p.createdAt,
				totalAssignments: total,
				completedAssignments: completed,
				overdueAssignments: overdue,
				completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
				avgQuizScore: avgScore,
				certificates: p.certificates.length,
				courses: p.courseAssignments.map((a) => ({
					courseId: a.course.id,
					courseTitle: a.course.title,
					status: a.status,
					dueDate: a.dueDate,
					overdue:
						a.dueDate && new Date(a.dueDate) < now && a.status !== "COMPLETED",
				})),
			};
		});

		const totals = {
			pharmacists: pharmacists.length,
			totalAssignments: pharmacistStats.reduce(
				(s, p) => s + p.totalAssignments,
				0,
			),
			completedAssignments: pharmacistStats.reduce(
				(s, p) => s + p.completedAssignments,
				0,
			),
			overdueAssignments: pharmacistStats.reduce(
				(s, p) => s + p.overdueAssignments,
				0,
			),
			totalCertificates: pharmacistStats.reduce(
				(s, p) => s + p.certificates,
				0,
			),
		};

		return NextResponse.json({ pharmacistStats, totals });
	} catch {
		return serverError("Failed to fetch supervisor analytics");
	}
}
