import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { badRequest, forbidden, serverError } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin } from "@/lib/request-security";

type RouteContext = {
	params: Promise<{ quizId: string }>;
};

function buildStartResponse(attempt: {
	id: string;
	attemptNumber: number;
	startedAt: Date;
}, timeLimitMinutes: number, serverNow: Date) {
	const expiresAt = new Date(attempt.startedAt.getTime() + timeLimitMinutes * 60_000);

	return NextResponse.json({
		attemptId: attempt.id,
		attemptNumber: attempt.attemptNumber,
		startedAt: attempt.startedAt.toISOString(),
		expiresAt: expiresAt.toISOString(),
		serverNow: serverNow.toISOString(),
		timeLimitSeconds: timeLimitMinutes * 60,
	});
}

export async function POST(req: Request, context: RouteContext) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const session = await getServerSession(authOptions);
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userId = session.user.id;
		const { quizId } = await context.params;
		if (!quizId) return badRequest("Quiz ID is required");

		const rateLimitResult = await rateLimit(`quiz-start:${userId}`, {
			windowMs: 60_000,
			maxRequests: 20,
		});

		if (!rateLimitResult.success) {
			return NextResponse.json(
				{ message: "Too many quiz starts. Please wait before trying again." },
				{
					status: 429,
					headers: { "Retry-After": String(rateLimitResult.retryAfter) },
				},
			);
		}

		const quiz = await prisma.quiz.findUnique({
			where: { id: quizId },
			include: {
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
				attempts: {
					where: { userId },
					orderBy: { attemptNumber: "desc" },
				},
			},
		});

		if (!quiz) {
			logger.warn("[QUIZ_START_NOT_FOUND]", { quizId, userId });
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
			logger.warn("[QUIZ_START_UNAUTHORIZED]", {
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
					logger.warn("[QUIZ_START_MEDIA_NOT_OPENED]", { userId, quizId });
					return forbidden("Open the lesson media before taking this quiz.");
				}
			}
		}

		const now = new Date();
		const timeLimitMs = quiz.timeLimit * 60_000;
		const activeAttempt = quiz.attempts.find((attempt) => !attempt.completedAt);

		if (activeAttempt) {
			const expiresAt = new Date(activeAttempt.startedAt.getTime() + timeLimitMs);
			if (expiresAt > now) {
				return buildStartResponse(activeAttempt, quiz.timeLimit, now);
			}

			await prisma.quizAttempt.updateMany({
				where: { id: activeAttempt.id, completedAt: null },
				data: {
					score: 0,
					passed: false,
					answers: "{}",
					completedAt: now,
				},
			});

			logger.warn("[QUIZ_START_EXPIRED_ATTEMPT_CLOSED]", {
				userId,
				quizId,
				attemptId: activeAttempt.id,
			});
		}

		const latestAttemptNumber = quiz.attempts[0]?.attemptNumber ?? 0;
		const nextAttemptNumber = latestAttemptNumber + 1;

		if (nextAttemptNumber > quiz.maxAttempts) {
			logger.warn("[QUIZ_START_MAX_ATTEMPTS]", {
				userId,
				quizId,
				maxAttempts: quiz.maxAttempts,
			});
			return NextResponse.json(
				{
					message: `Maximum quiz attempts (${quiz.maxAttempts}) reached`,
				},
				{ status: 400 },
			);
		}

		const attempt = await prisma.quizAttempt.create({
			data: {
				userId,
				quizId,
				score: 0,
				passed: false,
				answers: "{}",
				attemptNumber: nextAttemptNumber,
				startedAt: now,
			},
			select: {
				id: true,
				attemptNumber: true,
				startedAt: true,
			},
		});

		logger.info("[QUIZ_STARTED]", {
			userId,
			quizId,
			attemptId: attempt.id,
			attemptNumber: attempt.attemptNumber,
		});

		return buildStartResponse(attempt, quiz.timeLimit, now);
	} catch (error) {
		logger.error("[QUIZ_START_ERROR]", error as Error);
		return serverError("Failed to start quiz");
	}
}
