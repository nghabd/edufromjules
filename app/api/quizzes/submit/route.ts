import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import {
	normalizeAnswer,
	parseStoredCorrectAnswer,
	sameAnswers,
} from "@/lib/quiz-grading";

const QUIZ_SUBMIT_GRACE_MS = 30_000;

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const session = await getServerSession(authOptions);
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userId = session.user.id;
		const rateLimitResult = await rateLimit(`quiz-submit:${userId}`, {
			windowMs: 60_000,
			maxRequests: 30,
		});

		if (!rateLimitResult.success) {
			logger.warn("[QUIZ_RATE_LIMITED]", {
				userId,
				resetIn: rateLimitResult.resetIn,
			});
			return NextResponse.json(
				{ message: "Too many quiz submissions. Please wait before trying again." },
				{
					status: 429,
					headers: { "Retry-After": String(rateLimitResult.retryAfter) },
				},
			);
		}

		const body = await req.json().catch(() => null);
		if (!body) {
			return badRequest("Invalid request body");
		}

		const quizId = String(body?.quizId ?? "").trim();
		const attemptId = String(body?.attemptId ?? "").trim();
		const answers = (body?.answers ?? {}) as Record<string, unknown>;

		if (!quizId) {
			return badRequest("Quiz ID is required");
		}
		if (!attemptId) {
			return badRequest("Start the quiz before submitting answers.");
		}

		const quiz = await prisma.quiz.findUnique({
			where: { id: quizId },
			include: {
				questions: true,
				topic: {
					include: {
						course: true,
						materials: { select: { id: true } },
					},
				},
				course: {
					include: {
						topics: {
							include: {
								materials: { select: { id: true } },
							},
						},
					},
				},
			},
		});

		if (!quiz) {
			logger.warn("[QUIZ_NOT_FOUND]", { quizId, userId });
			return NextResponse.json({ message: "Quiz not found" }, { status: 404 });
		}

		const assignment = quiz.courseId
			? await prisma.courseAssignment.findFirst({
					where: { courseId: quiz.courseId, pharmacistId: userId },
				})
			: quiz.topic?.courseId
				? await prisma.courseAssignment.findFirst({
						where: { courseId: quiz.topic.courseId, pharmacistId: userId },
					})
				: null;

			if (!assignment && session.user.role === "PHARMACIST") {
				logger.warn("[QUIZ_UNAUTHORIZED]", {
					userId,
				quizId,
				role: session.user.role,
			});
				return forbidden("You don't have access to this quiz");
			}

			if (session.user.role === "PHARMACIST") {
				const requiredMaterialIds = quiz.topic
					? quiz.topic.materials.map((material) => material.id)
					: (quiz.course?.topics.flatMap((topic) =>
							topic.materials.map((material) => material.id),
						) ?? []);

				if (requiredMaterialIds.length) {
					const [openedEngagements, completedProgress] = await Promise.all([
						prisma.materialEngagement.findMany({
							where: {
								userId,
								materialId: { in: requiredMaterialIds },
							},
							select: { materialId: true },
						}),
						prisma.userProgress.findMany({
							where: {
								userId,
								materialId: { in: requiredMaterialIds },
								completed: true,
							},
							select: { materialId: true },
						}),
					]);

					const openedMaterialIds = new Set([
						...openedEngagements.map((item) => item.materialId),
						...completedProgress.map((item) => item.materialId),
					]);

					if (
						requiredMaterialIds.some(
							(materialId) => !openedMaterialIds.has(materialId),
						)
					) {
						logger.warn("[QUIZ_MEDIA_NOT_OPENED]", { userId, quizId });
						return forbidden("Open the lesson media before taking this quiz.");
					}
				}
			}

		const activeAttempt = await prisma.quizAttempt.findFirst({
			where: {
				id: attemptId,
				quizId,
				userId,
				completedAt: null,
			},
			select: {
				id: true,
				startedAt: true,
				attemptNumber: true,
			},
		});

		if (!activeAttempt) {
			logger.warn("[QUIZ_ATTEMPT_NOT_ACTIVE]", {
				userId,
				quizId,
				attemptId,
			});
			return NextResponse.json(
				{
					message: "Quiz attempt was not started or has already been submitted.",
				},
				{ status: 400 },
			);
		}

		const submittedAt = new Date();
		const timeLimitMs = quiz.timeLimit * 60_000;
		const elapsedMs = submittedAt.getTime() - activeAttempt.startedAt.getTime();
		if (elapsedMs > timeLimitMs + QUIZ_SUBMIT_GRACE_MS) {
			await prisma.quizAttempt.updateMany({
				where: { id: activeAttempt.id, completedAt: null },
				data: {
					score: 0,
					passed: false,
					answers: JSON.stringify(answers),
					completedAt: submittedAt,
				},
			});

			logger.warn("[QUIZ_TIME_EXCEEDED]", {
				userId,
				quizId,
				attemptId,
				elapsedMs,
				timeLimitMs,
			});

			return NextResponse.json(
				{
					message:
						"Quiz time limit exceeded. This attempt was recorded as expired.",
				},
				{ status: 400 },
			);
		}

		const totalPoints =
			quiz.questions.reduce((sum, question) => sum + question.points, 0) || 1;
		let earnedPoints = 0;

		for (const question of quiz.questions) {
			const expected = normalizeAnswer(
				parseStoredCorrectAnswer(question.correctAnswer),
				question.type,
			);
			const actual = normalizeAnswer(answers[question.id], question.type);
			if (sameAnswers(actual, expected)) {
				earnedPoints += question.points;
			}
		}

		const score = Math.round((earnedPoints / totalPoints) * 1000) / 10;
		const passed = score >= quiz.passingScore;

		const updateResult = await prisma.quizAttempt.updateMany({
			where: {
				id: activeAttempt.id,
				userId,
				quizId,
				completedAt: null,
			},
			data: {
				score,
				passed,
				answers: JSON.stringify(answers),
				completedAt: submittedAt,
			},
		});

		if (updateResult.count !== 1) {
			return badRequest("Quiz attempt has already been submitted.");
		}

		const attempt = await prisma.quizAttempt.findUniqueOrThrow({
			where: { id: activeAttempt.id },
		});

		logger.info("[QUIZ_SUBMITTED]", {
			userId,
			quizId,
			attemptNumber: activeAttempt.attemptNumber,
			score,
			passed,
		});

		if (quiz.topic && passed) {
			await prisma.userProgress.updateMany({
				where: { userId, material: { topicId: quiz.topic.id } },
				data: {
					completed: true,
					progress: score,
					completionStatus: "APPROVED",
				},
			});

			logger.info("[QUIZ_PROGRESS_UPDATED]", {
				userId,
				topicId: quiz.topic.id,
			});
		}

		const courseId = quiz.courseId ?? quiz.topic?.courseId;
		if (courseId && passed) {
			await prisma.notification.create({
				data: {
					userId,
					title: "Quiz Passed",
					message: `You passed "${quiz.title}" with ${score.toFixed(1)}%.`,
					type: "SUCCESS",
				},
			});
		}

		// Try to auto-issue certificate if quiz is final course quiz and all requirements met
		if (quiz.scope === "COURSE" && quiz.courseId) {
			const { issueCourseCertificateIfComplete } = await import("@/lib/certificates");
			void issueCourseCertificateIfComplete(userId, quiz.courseId).catch((err) =>
				console.error("[CERT_AUTO_ISSUE_FAILED]", err),
			);
		}

		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.progressChanged,
		]);

		return NextResponse.json({
			...attempt,
			score: parseFloat(score.toFixed(2)),
			passed,
		});
	} catch (error) {
		logger.error("[QUIZ_SUBMIT_ERROR]", error as Error);
		return serverError("Failed to submit quiz");
	}
}
