import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { courseResponseInclude } from "@/lib/course-payload-read";
import { calculateLessonBasedCourseProgress } from "@/lib/course-progress";

export async function GET() {
	try {
		const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const groupTrainees = await prisma.user.findMany({
			where: {
				role: "PHARMACIST",
				OR: [
					{ supervisorId: session.user.id },
					{ group: { supervisorId: session.user.id } },
				],
			},
			select: {
				id: true,
				name: true,
				email: true,
				courseAssignments: {
					select: {
						id: true,
						status: true,
						dueDate: true,
						course: {
							select: {
								id: true,
								title: true,
								topics: {
									select: {
										materials: { select: { id: true } },
										requiredQuiz: {
											select: { id: true, passingScore: true },
										},
									},
								},
							},
						},
					},
				},
				progress: { select: { materialId: true, completed: true } },
				quizAttempts: { select: { quizId: true, score: true } },
			},
			orderBy: { name: "asc" },
		});

		const formattedTrainees = groupTrainees.map((trainee) => {
			// Get all material IDs this user has finished
			const completedMaterialIds = new Set(
				trainee.progress.filter((p) => p.completed).map((p) => p.materialId),
			);
			const bestScoreByQuiz = new Map<string, number>();
			trainee.quizAttempts.forEach((attempt) => {
				bestScoreByQuiz.set(
					attempt.quizId,
					Math.max(bestScoreByQuiz.get(attempt.quizId) ?? 0, attempt.score),
				);
			});

			const assignmentsWithProgress = trainee.courseAssignments.map(
				(assign) => {
					const progressSummary = calculateLessonBasedCourseProgress(
						assign.course.topics,
						completedMaterialIds,
						bestScoreByQuiz,
					);
					const progressPercent = progressSummary.percent;
					const actualStatus =
						progressPercent === 100
							? "COMPLETED"
							: progressPercent > 0
								? "IN PROGRESS"
								: "NOT STARTED";

					return {
						id: assign.id,
						status: actualStatus,
						progress: progressPercent,
						dueDate: assign.dueDate,
						course: { id: assign.course.id, title: assign.course.title },
					};
				},
			);

			return {
				id: trainee.id,
				name: trainee.name,
				email: trainee.email,
				assignments: assignmentsWithProgress,
				_count: { assignments: trainee.courseAssignments.length },
			};
		});

		// Fetch courses INCLUDING topics and materials so the CourseBuilder can edit them!
		const courses = await prisma.course.findMany({
			include: courseResponseInclude,
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json({ groupTrainees: formattedTrainees, courses });
	} catch {
		return serverError("Failed to fetch supervisor overview");
	}
}
