import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateLessonBasedCourseProgress } from "@/lib/course-progress";
import { getMaterialDeliveryUrl } from "@/lib/material-url";
import { issueCourseCertificateIfComplete } from "@/lib/certificates";

export const dynamic = "force-dynamic";

export async function GET() {
	const { error, session } = await requireRole(["PHARMACIST"]);
	if (error) return error;

	const assignments = await prisma.courseAssignment.findMany({
		where: { pharmacistId: session.user.id },
		include: {
			course: {
				include: {
					topics: {
						orderBy: { order: "asc" },
						include: {
							materials: { orderBy: { order: "asc" } },
							requiredQuiz: { include: { questions: true } },
						},
					},
					quizzes: { where: { scope: "COURSE" }, include: { questions: true } },
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	let progress = await prisma.userProgress.findMany({
		where: { userId: session.user.id },
		select: {
			id: true,
			materialId: true,
			completed: true,
			completionStatus: true,
			progress: true,
			timeSpent: true,
			lastAccessed: true,
			approvedBy: true,
			approvedAt: true,
		},
	});

	let progressByMaterial = new Map(
		progress.map((item) => [item.materialId, item]),
	);

	const assignedMaterialIds = [
		...new Set(
			assignments.flatMap((assignment) =>
				assignment.course.topics.flatMap((topic) =>
					topic.materials.map((material) => material.id),
				),
			),
		),
	];

	const missingProgressMaterialIds = assignedMaterialIds.filter(
		(materialId) => !progressByMaterial.has(materialId),
	);

	if (missingProgressMaterialIds.length > 0) {
		await prisma.userProgress.createMany({
			data: missingProgressMaterialIds.map((materialId) => ({
				userId: session.user.id,
				materialId,
			})),
			skipDuplicates: true,
		});

		progress = await prisma.userProgress.findMany({
			where: { userId: session.user.id },
			select: {
				id: true,
				materialId: true,
				completed: true,
				completionStatus: true,
				progress: true,
				timeSpent: true,
				lastAccessed: true,
				approvedBy: true,
				approvedAt: true,
			},
		});
		progressByMaterial = new Map(
			progress.map((item) => [item.materialId, item]),
		);
	}

	const openedEngagements = assignedMaterialIds.length
		? await prisma.materialEngagement.findMany({
				where: {
					userId: session.user.id,
					materialId: { in: assignedMaterialIds },
				},
				select: { materialId: true },
			})
		: [];

	const openedMaterialIds = new Set(
		openedEngagements.map((item) => item.materialId),
	);
	const isMaterialOpened = (materialId: string) =>
		openedMaterialIds.has(materialId) ||
		(progressByMaterial.get(materialId)?.completed ?? false);

	const quizIds = assignments.flatMap((assignment) => [
		...assignment.course.topics.flatMap((topic) =>
			topic.requiredQuiz ? [topic.requiredQuiz.id] : [],
		),
		...assignment.course.quizzes.map((quiz) => quiz.id),
	]);

	const attempts = await prisma.quizAttempt.findMany({
		where: { userId: session.user.id, quizId: { in: quizIds } },
		orderBy: { completedAt: "desc" },
	});

	const bestScoreByQuiz = new Map<string, number>();
	attempts.forEach((attempt) => {
		bestScoreByQuiz.set(
			attempt.quizId,
			Math.max(bestScoreByQuiz.get(attempt.quizId) ?? 0, attempt.score),
		);
	});

	const assignedCourses = assignments.map((assignment) => {
		const completedMaterialIds = new Set(
			assignment.course.topics.flatMap((topic) =>
				topic.materials
					.filter((material) => progressByMaterial.get(material.id)?.completed)
					.map((material) => material.id),
			),
		);
		const lessonProgress = calculateLessonBasedCourseProgress(
			assignment.course.topics,
			completedMaterialIds,
			bestScoreByQuiz,
		);
		const courseMaterials = assignment.course.topics.flatMap(
			(topic) => topic.materials,
		);

		return {
			assignmentId: assignment.id,
			dueDate: assignment.dueDate,
			status: assignment.status,
			courseId: assignment.course.id,
			courseName: assignment.course.title,
			description: assignment.course.description,
			category: assignment.course.category,
			totalTopics: assignment.course.topics.length,
			completedTopics: lessonProgress.completedLessons,
			progress: lessonProgress.percent,
			lastAccessed: progress[0]?.lastAccessed ?? assignment.createdAt,
			topics: assignment.course.topics.map((topic) => ({
				id: topic.id,
				title: topic.title,
				description: topic.description,
				materials: topic.materials.map((material) => ({
					progressId: progressByMaterial.get(material.id)?.id ?? null,
					id: material.id,
					title: material.title,
					type: material.type,
					url: getMaterialDeliveryUrl(material),
					gateQuestion: material.gateQuestion,
					duration: material.duration,
					content: material.content, // FIXED: Now rich text will appear
					opened: isMaterialOpened(material.id),
					completed: progressByMaterial.get(material.id)?.completed ?? false,
					completionStatus:
						progressByMaterial.get(material.id)?.completionStatus ?? "PENDING",
					approvedBy: progressByMaterial.get(material.id)?.approvedBy ?? null,
					approvedAt: progressByMaterial.get(material.id)?.approvedAt ?? null,
					progress: progressByMaterial.get(material.id)?.progress ?? 0,
				})),
				quizAvailable:
					topic.materials.length === 0 ||
					topic.materials.every((material) => isMaterialOpened(material.id)),
				quiz: topic.requiredQuiz
					? {
							id: topic.requiredQuiz.id,
							title: topic.requiredQuiz.title,
							passingScore: topic.requiredQuiz.passingScore,
							timeLimit: topic.requiredQuiz.timeLimit,
							bestScore: bestScoreByQuiz.get(topic.requiredQuiz.id) ?? 0,
							questions: topic.requiredQuiz.questions.map((question) => ({
								id: question.id,
								question: question.question,
								type: question.type,
								options: JSON.parse(question.options) as string[],
							})),
					}
				: null,
		})),
			courseQuizAvailable:
				courseMaterials.length === 0 ||
				courseMaterials.every((material) => isMaterialOpened(material.id)),
			courseQuiz: assignment.course.quizzes[0]
				? {
						id: assignment.course.quizzes[0].id,
						title: assignment.course.quizzes[0].title,
						passingScore: assignment.course.quizzes[0].passingScore,
						timeLimit: assignment.course.quizzes[0].timeLimit,
						bestScore:
							bestScoreByQuiz.get(assignment.course.quizzes[0].id) ?? 0,
						questions: assignment.course.quizzes[0].questions.map(
							(question) => ({
								id: question.id,
								question: question.question,
								type: question.type,
								options: JSON.parse(question.options) as string[],
							}),
						),
					}
				: null,
		};
	});

	await Promise.all(
		assignedCourses
			.filter((course) => course.progress === 100)
			.map((course) =>
				issueCourseCertificateIfComplete(session.user.id, course.courseId).catch(
					(error) => {
						console.error("[CERTIFICATE_BACKFILL_FAILED]", error);
					},
				),
			),
	);

	return NextResponse.json({
		assignedCourses,
		coursesInProgress: assignedCourses.filter(
			(course) => course.progress < 100,
		),
		completedCourses: assignedCourses.filter(
			(course) => course.progress === 100,
		),
		upcomingDeadlines: assignedCourses.filter(
			(course) => course.dueDate && course.progress < 100,
		),
		totalHoursLearned: Math.round(
			progress.reduce((sum, item) => sum + item.timeSpent, 0) / 3600,
		),
		averageQuizScore: attempts.length
			? Math.round(
					attempts.reduce((sum, attempt) => sum + attempt.score, 0) /
						attempts.length,
				)
			: 0,
		certificatesEarned: await prisma.certificate.count({
			where: { userId: session.user.id },
		}),
	});
}
