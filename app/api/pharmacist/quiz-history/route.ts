import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireRole(["PHARMACIST", "SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const attempts = await prisma.quizAttempt.findMany({
			where: { userId: session.user.id, completedAt: { not: null } },
			orderBy: { startedAt: "desc" },
			include: {
				quiz: {
					select: {
						id: true,
						title: true,
						passingScore: true,
						timeLimit: true,
						questions: {
							select: {
								id: true,
								question: true,
								options: true,
								correctAnswer: true,
								explanation: true,
								type: true,
								points: true,
							},
						},
					},
				},
			},
		});

		const formatted = attempts.map((attempt) => {
			let parsedAnswers: Record<string, unknown> = {};
			try {
				parsedAnswers = JSON.parse(attempt.answers);
			} catch {
				/* ignore */
			}

			const questions = attempt.quiz.questions.map((q) => {
				let correctAnswer: unknown = q.correctAnswer;
				try {
					correctAnswer = JSON.parse(q.correctAnswer);
				} catch {
					/* keep as string */
				}

				let options: string[] = [];
				try {
					options = JSON.parse(q.options);
				} catch {
					/* keep as empty */
				}

				const userAnswer = parsedAnswers[q.id];
				const userArr = Array.isArray(userAnswer)
					? userAnswer.map(String)
					: typeof userAnswer === "string"
						? [userAnswer]
						: [];
				const correctArr = Array.isArray(correctAnswer)
					? correctAnswer.map(String)
					: typeof correctAnswer === "string"
						? [correctAnswer]
						: [];

				const isCorrect =
					userArr.length === correctArr.length &&
					[...userArr].sort().every((v, i) => v === [...correctArr].sort()[i]);

				return {
					id: q.id,
					question: q.question,
					type: q.type,
					options,
					userAnswer: userArr,
					correctAnswer: correctArr,
					explanation: q.explanation,
					isCorrect,
					points: q.points,
				};
			});

			return {
				id: attempt.id,
				quizId: attempt.quizId,
				quizTitle: attempt.quiz.title,
				passingScore: attempt.quiz.passingScore,
				score: attempt.score,
				passed: attempt.passed,
				attemptNumber: attempt.attemptNumber,
				startedAt: attempt.startedAt,
				completedAt: attempt.completedAt,
				timeTakenSeconds: attempt.completedAt
					? Math.round(
							(new Date(attempt.completedAt).getTime() -
								new Date(attempt.startedAt).getTime()) /
								1000,
						)
					: null,
				questions,
			};
		});

		return NextResponse.json({ attempts: formatted });
	} catch {
		return serverError("Failed to fetch quiz history");
	}
}
