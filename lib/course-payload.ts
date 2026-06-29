import { sanitizeHTML } from "@/lib/input-sanitization";
import type { CourseBuilderInput, QuizQuestionInput } from "@/lib/schemas";

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: {};
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function asTrimmedString(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

function parseStringArray(value: unknown) {
	if (Array.isArray(value)) {
		return value.map(asTrimmedString).filter(Boolean);
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed ? [trimmed] : [];
	}

	return [];
}

function normalizeQuestion(question: QuizQuestionInput) {
	const options = question.options.map((option) => option.trim()).filter(Boolean);
	const correctAnswers = question.correctAnswers
		.map((answer) => answer.trim())
		.filter(Boolean);

	if (question.type === "TRUE_FALSE") {
		const normalized = correctAnswers[0].toLowerCase() === "true" ? "True" : "False";
		return {
			...question,
			options: ["True", "False"],
			correctAnswers: [normalized],
		};
	}

	if (question.type === "COMPLETE") {
		return {
			...question,
			options: [],
			correctAnswers: [correctAnswers[0]],
		};
	}

	if (question.type === "MULTI_SELECT") {
		return {
			...question,
			options,
			correctAnswers: [...new Set(correctAnswers)],
		};
	}

	return {
		...question,
		options,
		correctAnswers: [correctAnswers[0]],
	};
}

export function normalizeCourseBuilderPayload(payload: unknown) {
	const source = asRecord(payload);
	const topics = asArray(source.topics);

	return {
		title: asTrimmedString(source.title),
		description: asTrimmedString(source.description),
		category: asTrimmedString(source.category),
		topics: topics.map((topicValue) => {
			const topic = asRecord(topicValue);
			const materials = asArray(topic.materials)
				.map((materialValue) => {
					const material = asRecord(materialValue);
					return {
						id: asTrimmedString(material.id),
						title: asTrimmedString(material.title),
						type: asTrimmedString(material.type) || "RICH_TEXT",
						url: asTrimmedString(material.url),
						content: asTrimmedString(material.content),
						storageProvider: asTrimmedString(material.storageProvider) || undefined,
						storagePath: asTrimmedString(material.storagePath) || undefined,
						storageKey: asTrimmedString(material.storageKey) || undefined,
						fileSize:
							typeof material.fileSize === "number"
								? material.fileSize
								: material.fileSize
									? Number(material.fileSize)
									: undefined,
						contentType: asTrimmedString(material.contentType) || undefined,
						uploadedAt: asTrimmedString(material.uploadedAt) || undefined,
						duration:
							typeof material.duration === "number"
								? material.duration
								: material.duration
									? Number(material.duration)
									: undefined,
						gateQuestion: asTrimmedString(material.gateQuestion) || undefined,
						gateAnswer: asTrimmedString(material.gateAnswer) || undefined,
					};
				})
				.filter((material) =>
					Boolean(
						material.title ||
							material.url ||
							material.content ||
							material.storageKey ||
							material.storagePath,
					),
				);

			const quiz = asRecord(topic.quiz);
			const questions = asArray(quiz.questions);

			return {
				id: asTrimmedString(topic.id),
				title: asTrimmedString(topic.title),
				description: asTrimmedString(topic.description),
				materials,
				quiz: quiz && Object.keys(quiz).length
					? {
							id: asTrimmedString(quiz.id),
							title: asTrimmedString(quiz.title) || "Lesson Quiz",
							passingScore:
								typeof quiz.passingScore === "number"
									? quiz.passingScore
									: Number(quiz.passingScore) || 70,
							timeLimit:
								typeof quiz.timeLimit === "number"
									? quiz.timeLimit
									: Number(quiz.timeLimit) || 15,
							maxAttempts:
								typeof quiz.maxAttempts === "number"
									? quiz.maxAttempts
									: Number(quiz.maxAttempts) || 3,
							questions: questions.map((questionValue) => {
								const questionRecord = asRecord(questionValue);
								return {
									id: asTrimmedString(questionRecord.id),
									question: asTrimmedString(questionRecord.question),
									type: asTrimmedString(questionRecord.type) || "RADIO",
									options: parseStringArray(questionRecord.options),
									correctAnswers: parseStringArray(
										questionRecord.correctAnswers ??
											questionRecord.correctAnswer,
									),
									explanation:
										asTrimmedString(questionRecord.explanation) || undefined,
									points:
										typeof questionRecord.points === "number"
											? (questionRecord.points as number)
											: Number(questionRecord.points) || 1,
								};
							}),
						}
					: null,
			};
		}),
	};
}

export function buildMaterialWriteData(
	material: CourseBuilderInput["topics"][number]["materials"][number],
	index: number,
) {
	const storageKey = material.storageKey?.trim() || undefined;
	const storagePath = material.storagePath?.trim() || storageKey;
	const uploadedAt = material.uploadedAt
		? new Date(material.uploadedAt)
		: undefined;
	const storageProvider =
		material.storageProvider ||
		(storageKey || material.url ? "CLOUDFLARE" : "LOCAL");

	return {
		title: material.title,
		type: material.type,
		url: material.type === "RICH_TEXT" ? "" : material.url || "",
		content:
			material.type === "RICH_TEXT" || material.type === "PRACTICAL"
				? sanitizeHTML(material.content || "")
				: null,
		storageProvider,
		storagePath,
		storageKey,
		fileSize: material.fileSize,
		contentType: material.contentType,
		uploadedAt,
		duration: material.duration,
		gateQuestion: material.gateQuestion || null,
		gateAnswer: material.gateAnswer || null,
		order: index + 1,
	};
}

export function buildLessonQuizWriteData(
	quiz: NonNullable<CourseBuilderInput["topics"][number]["quiz"]>,
) {
	return {
		title: quiz.title || "Lesson Quiz",
		passingScore: quiz.passingScore,
		timeLimit: quiz.timeLimit,
		maxAttempts: quiz.maxAttempts,
		scope: "LESSON",
	};
}

export function buildQuestionWriteData(
	question: QuizQuestionInput,
	index: number,
) {
	const normalized = normalizeQuestion(question);
	return {
		question: normalized.question,
		options: JSON.stringify(normalized.options),
		correctAnswer: JSON.stringify(normalized.correctAnswers),
		explanation: normalized.explanation || null,
		type: normalized.type,
		points: normalized.points,
		order: index + 1,
	};
}

export function buildTopicCreateData(topics: CourseBuilderInput["topics"]) {
	return topics.map((topic, tIndex) => ({
		title: topic.title,
		description: topic.description || "",
		order: tIndex + 1,
		materials: {
			create: topic.materials.map(buildMaterialWriteData),
		},
		requiredQuiz: topic.quiz
			? {
					create: {
						...buildLessonQuizWriteData(topic.quiz),
						questions: {
							create: topic.quiz.questions.map(buildQuestionWriteData),
						},
					},
				}
			: undefined,
	}));
}

export const courseResponseInclude = {
	topics: {
		orderBy: { order: "asc" as const },
		include: {
			materials: { orderBy: { order: "asc" as const } },
			requiredQuiz: {
				include: { questions: { orderBy: { order: "asc" as const } } },
			},
		},
	},
	quizzes: {
		where: { scope: "COURSE" },
		include: { questions: { orderBy: { order: "asc" as const } } },
	},
	_count: { select: { assignments: true } },
};
