import type {
	CourseFormDraft,
	LessonQuizDraft,
	MaterialDraft,
	QuestionType,
	QuizQuestionDraft,
	TopicDraft,
} from "./types";

export function createDefaultQuestion(
	type: QuestionType = "RADIO",
): QuizQuestionDraft {
	if (type === "TRUE_FALSE") {
		return {
			question: "",
			type,
			options: ["True", "False"],
			correctAnswers: ["True"],
			points: 1,
		};
	}

	if (type === "COMPLETE") {
		return {
			question: "",
			type,
			options: [],
			correctAnswers: [""],
			points: 1,
		};
	}

	return {
		question: "",
		type,
		options: ["Option A", "Option B"],
		correctAnswers: ["Option A"],
		points: 1,
	};
}

export function createDefaultQuiz(): LessonQuizDraft {
	return {
		title: "Lesson Assessment",
		passingScore: 70,
		timeLimit: 15,
		maxAttempts: 3,
		questions: [createDefaultQuestion()],
	};
}

export function createArticleMaterial(): MaterialDraft {
	return {
		title: "Lesson Article",
		type: "RICH_TEXT",
		url: "",
		content: "",
	};
}

export function createAttachmentMaterial(): MaterialDraft {
	return {
		title: "",
		type: "PDF",
		url: "",
		content: "",
	};
}

export function createDefaultTopic(): TopicDraft {
	return {
		title: "",
		description: "",
		materials: [createArticleMaterial()],
		quiz: null,
	};
}

export function createDefaultCourseForm(): CourseFormDraft {
	return {
		title: "",
		description: "",
		category: "Medicine",
		topics: [createDefaultTopic()],
	};
}

function parseStringArray(value: unknown, fallback: string[] = []) {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value !== "string") return fallback;
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map(String) : fallback;
	} catch {
		return fallback;
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: {};
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

export function normalizeQuestionFromApi(question: unknown): QuizQuestionDraft {
	const source = asRecord(question);
	const type = (String(source.type || "RADIO")) as QuestionType;
	const options = parseStringArray(
		source.options,
		type === "TRUE_FALSE" ? ["True", "False"] : [],
	);
	const correctAnswers = parseStringArray(source.correctAnswer, []);

	return {
		id: typeof source.id === "string" ? source.id : undefined,
		question: String(source.question || ""),
		type,
		options,
		correctAnswers:
			correctAnswers.length > 0
				? correctAnswers
				: [type === "TRUE_FALSE" ? "True" : options[0] || ""],
		explanation: String(source.explanation || ""),
		points: Number(source.points) || 1,
	};
}

export function normalizeCourseForEditor(course: unknown): CourseFormDraft {
	if (!course) return createDefaultCourseForm();
	const source = asRecord(course);

	return {
		title: String(source.title || ""),
		description: String(source.description || ""),
		category: String(source.category || "Medicine"),
		topics: asArray(source.topics).length
			? asArray(source.topics).map((topicValue) => {
					const topic = asRecord(topicValue);
					const materials = asArray(topic.materials);
					const requiredQuiz = asRecord(topic.requiredQuiz);
					return {
						id: typeof topic.id === "string" ? topic.id : undefined,
						title: String(topic.title || ""),
						description: String(topic.description || ""),
						materials: materials.length
							? materials.map((materialValue) => {
									const material = asRecord(materialValue);
									return {
										id:
											typeof material.id === "string"
												? material.id
												: undefined,
										title: String(material.title || ""),
										type: String(material.type || "RICH_TEXT") as MaterialDraft["type"],
										url: String(material.url || ""),
										content: String(material.content || ""),
										storageProvider:
											typeof material.storageProvider === "string"
												? material.storageProvider
												: undefined,
										storagePath:
											typeof material.storagePath === "string"
												? material.storagePath
												: undefined,
										storageKey:
											typeof material.storageKey === "string"
												? material.storageKey
												: undefined,
										fileSize:
											typeof material.fileSize === "number"
												? material.fileSize
												: undefined,
										contentType:
											typeof material.contentType === "string"
												? material.contentType
												: undefined,
										uploadedAt:
											typeof material.uploadedAt === "string"
												? material.uploadedAt
												: undefined,
										duration: material.duration
											? Number(material.duration)
											: undefined,
										gateQuestion: String(material.gateQuestion || ""),
										gateAnswer: String(material.gateAnswer || ""),
									};
								})
							: [createArticleMaterial()],
						quiz: Object.keys(requiredQuiz).length
							? {
									id:
										typeof requiredQuiz.id === "string"
											? requiredQuiz.id
											: undefined,
									title: String(requiredQuiz.title || "Lesson Assessment"),
									passingScore: Number(requiredQuiz.passingScore) || 70,
									timeLimit: Number(requiredQuiz.timeLimit) || 15,
									maxAttempts: Number(requiredQuiz.maxAttempts) || 3,
									questions: asArray(requiredQuiz.questions).length
										? asArray(requiredQuiz.questions).map(normalizeQuestionFromApi)
										: [createDefaultQuestion()],
								}
							: null,
					};
				})
			: [createDefaultTopic()],
	};
}
