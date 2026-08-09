import { prisma } from "@/lib/prisma";
import {
	calculateCourseCompletionStatus,
	calculateLessonBasedCourseProgress,
	calculatePartBasedCourseProgress,
} from "@/lib/course-progress";
import { createNotification } from "@/lib/notifications";
import { publishRealtimeEvent } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export async function issueCourseCertificateIfComplete(
	userId: string,
	courseId: string,
) {
	const assignment = await prisma.courseAssignment.findFirst({
		where: { pharmacistId: userId, courseId },
		include: {
			pharmacist: { select: { name: true, email: true } },
			course: {
				select: {
					id: true,
					title: true,
					topics: {
						select: {
							materials: { select: { id: true } },
							requiredQuiz: { select: { id: true, passingScore: true } },
						},
					},
					quizzes: {
						where: { scope: "COURSE" },
						select: { id: true, passingScore: true },
					},
				},
			},
		},
	});

	if (!assignment) return null;

	const materialIds = assignment.course.topics.flatMap((topic) =>
		topic.materials.map((material) => material.id),
	);
	const quizIds = [
		...assignment.course.topics.flatMap((topic) =>
			topic.requiredQuiz ? [topic.requiredQuiz.id] : [],
		),
		...assignment.course.quizzes.map((quiz) => quiz.id),
	];

	const [completedProgress, attempts] = await Promise.all([
		materialIds.length
			? prisma.userProgress.findMany({
					where: {
						userId,
						materialId: { in: materialIds },
						completed: true,
					},
					select: { materialId: true },
				})
			: [],
		quizIds.length
			? prisma.quizAttempt.findMany({
					where: { userId, quizId: { in: quizIds } },
					select: { quizId: true, score: true },
				})
			: [],
	]);

	const completedMaterialIds = new Set(
		completedProgress.map((item) => item.materialId),
	);
	const bestScoreByQuiz = new Map<string, number>();
	attempts.forEach((attempt) => {
		bestScoreByQuiz.set(
			attempt.quizId,
			Math.max(bestScoreByQuiz.get(attempt.quizId) ?? 0, attempt.score),
		);
	});

	const lessonProgress = calculateLessonBasedCourseProgress(
		assignment.course.topics,
		completedMaterialIds,
		bestScoreByQuiz,
	);
	const courseQuiz = assignment.course.quizzes[0] ?? null;
	const partProgress = calculatePartBasedCourseProgress(
		assignment.course.topics,
		completedMaterialIds,
		bestScoreByQuiz,
		courseQuiz,
	);
	const completion = calculateCourseCompletionStatus(
		lessonProgress,
		courseQuiz,
		bestScoreByQuiz,
		partProgress.percent,
	);

	if (!completion.completed) return null;

	const existingCertificate = await prisma.certificate.findFirst({
		where: { userId, courseId: assignment.course.id },
	});
	if (existingCertificate) return existingCertificate;

	const certificate = await prisma.certificate.create({
		data: {
			userId,
			courseId: assignment.course.id,
			courseName: assignment.course.title,
		},
	});

	await publishRealtimeEvent(REALTIME_EVENTS.certificateIssued, {
		userId,
		courseId: assignment.course.id,
		certificateId: certificate.id,
	});

	await createNotification({
		userId,
		title: "Certificate earned",
		message: `Your certificate for ${assignment.course.title} is ready.`,
		type: "SUCCESS",
		email: true,
	});

	return certificate;
}
