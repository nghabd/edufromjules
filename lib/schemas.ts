import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "SUPERVISOR", "PHARMACIST"]);

export const quizQuestionTypeSchema = z.enum([
	"RADIO",
	"SELECT",
	"MULTI_SELECT",
	"TRUE_FALSE",
	"COMPLETE",
]);

export const materialTypeSchema = z.enum([
	"RICH_TEXT",
	"PDF",
	"VIDEO",
	"PRACTICAL",
	"IMAGE",
	"DOCUMENT",
	"PRESENTATION",
]);

const textField = (min = 1, max = 255) => z.string().trim().min(min).max(max);
const optionalEntityId = z.string().trim().min(1).optional();

export const assignCourseSchema = z.object({
	courseId: z.string().min(1),
	pharmacistId: z.string().min(1),
	dueDate: z
		.string()
		.datetime()
		.optional()
		.or(z.null())
		.or(z.literal("")),
});

export const assignCoursesSchema = z.object({
	courseId: z.string().min(1),
	userIds: z.array(z.string().min(1)).min(1).max(100),
	dueDate: z
		.string()
		.datetime()
		.optional()
		.or(z.null())
		.or(z.literal("")),
});

export const createQuizSchema = z.object({
	courseId: z.string().min(1),
	topicId: z.string().optional().nullable(),
	title: z.string().min(1),
	question: z.string().min(5),
	type: quizQuestionTypeSchema.default("RADIO"),
	options: z.array(z.string().min(1)).default([]),
	correctAnswers: z.array(z.string().min(1)).min(1),
});

export const quizQuestionInputSchema = z
	.object({
		id: optionalEntityId,
		question: textField(5, 2000),
		type: quizQuestionTypeSchema.default("RADIO"),
		options: z.array(textField(1, 500)).default([]),
		correctAnswers: z.array(textField(1, 500)).optional(),
		correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
		explanation: z.string().trim().max(2000).optional().nullable(),
		points: z.coerce.number().int().min(1).max(100).default(1),
	})
	.transform((question) => {
		const legacyAnswers = Array.isArray(question.correctAnswer)
			? question.correctAnswer
			: question.correctAnswer
				? [question.correctAnswer]
				: [];

		const correctAnswers =
			question.correctAnswers?.length ? question.correctAnswers : legacyAnswers;

		return {
			id: question.id,
			question: question.question,
			type: question.type,
			options: question.options,
			correctAnswers: correctAnswers.map((answer) => String(answer).trim()),
			explanation: question.explanation?.trim() || undefined,
			points: question.points,
		};
	})
	.superRefine((question, ctx) => {
		const options = question.options.map((option) => option.trim()).filter(Boolean);
		const correctAnswers = question.correctAnswers
			.map((answer) => answer.trim())
			.filter(Boolean);

		if (!correctAnswers.length) {
			ctx.addIssue({
				code: "custom",
				path: ["correctAnswers"],
				message: "Set at least one correct answer.",
			});
			return;
		}

		if (question.type === "TRUE_FALSE") {
			if (correctAnswers.length !== 1) {
				ctx.addIssue({
					code: "custom",
					path: ["correctAnswers"],
					message: "True/False questions accept one correct answer.",
				});
			}

			const normalized = correctAnswers[0]?.toLowerCase();
			if (normalized !== "true" && normalized !== "false") {
				ctx.addIssue({
					code: "custom",
					path: ["correctAnswers"],
					message: "True/False answer must be True or False.",
				});
			}
			return;
		}

		if (question.type === "COMPLETE") {
			if (correctAnswers.length !== 1) {
				ctx.addIssue({
					code: "custom",
					path: ["correctAnswers"],
					message: "Complete questions accept one answer.",
				});
			}
			return;
		}

		if (options.length < 2) {
			ctx.addIssue({
				code: "custom",
				path: ["options"],
				message: "Add at least two options.",
			});
		}

		if (new Set(options).size !== options.length) {
			ctx.addIssue({
				code: "custom",
				path: ["options"],
				message: "Duplicate options are not allowed.",
			});
		}

		const optionSet = new Set(options);
		const everyAnswerExists = correctAnswers.every((answer) =>
			optionSet.has(answer),
		);

		if (!everyAnswerExists) {
			ctx.addIssue({
				code: "custom",
				path: ["correctAnswers"],
				message: "Correct answers must match the provided options.",
			});
		}

		if (
			(question.type === "RADIO" || question.type === "SELECT") &&
			correctAnswers.length !== 1
		) {
			ctx.addIssue({
				code: "custom",
				path: ["correctAnswers"],
				message: "Single-choice questions accept one correct answer.",
			});
		}
	});

export const lessonQuizInputSchema = z
	.object({
		id: optionalEntityId,
		title: textField(1, 255).default("Lesson Quiz"),
		passingScore: z.coerce.number().int().min(1).max(100).default(70),
		timeLimit: z.coerce.number().int().min(1).max(240).default(15),
		maxAttempts: z.coerce.number().int().min(1).max(20).default(3),
		questions: z.array(quizQuestionInputSchema).min(1).max(100),
	})
	.nullable()
	.optional();

export const courseMaterialInputSchema = z
	.object({
		id: optionalEntityId,
		title: textField(1, 255),
		type: materialTypeSchema.default("RICH_TEXT"),
		url: z.string().trim().max(2048).optional().default(""),
		content: z.string().max(250_000).optional().default(""),
		storageProvider: z.string().trim().max(50).optional(),
		storagePath: z.string().trim().max(2048).optional(),
		storageKey: z.string().trim().max(2048).optional(),
		fileSize: z.coerce.number().int().min(0).optional(),
		contentType: z.string().trim().max(255).optional(),
		uploadedAt: z.string().datetime().optional(),
		duration: z.coerce.number().int().min(0).max(100_000).optional(),
		gateQuestion: z.string().trim().max(500).optional().nullable(),
		gateAnswer: z.string().trim().max(500).optional().nullable(),
	})
	.superRefine((material, ctx) => {
		const hasTimedGate = ["PDF", "VIDEO", "IMAGE"].includes(material.type);
		const hasGateQuestion = Boolean(material.gateQuestion?.trim());
		const hasGateAnswer = Boolean(material.gateAnswer?.trim());

		if (
			["PDF", "VIDEO", "IMAGE", "DOCUMENT", "PRESENTATION"].includes(
				material.type,
			) &&
			!material.url?.trim() &&
			!material.storageKey?.trim()
		) {
			ctx.addIssue({
				code: "custom",
				path: ["url"],
				message: "Uploaded materials need a file URL or storage key.",
			});
		}

		if (hasTimedGate && (hasGateQuestion || hasGateAnswer)) {
			if (!hasGateQuestion) {
				ctx.addIssue({
					code: "custom",
					path: ["gateQuestion"],
					message: "Timer question is required when an expected answer is set.",
				});
			}
			if (!hasGateAnswer) {
				ctx.addIssue({
					code: "custom",
					path: ["gateAnswer"],
					message: "Expected answer is required when a timer question is set.",
				});
			}
		}
	});

export const courseTopicInputSchema = z.object({
	id: optionalEntityId,
	title: textField(1, 255),
	description: z.string().trim().max(2000).optional().default(""),
	materials: z.array(courseMaterialInputSchema).max(100).default([]),
	quiz: lessonQuizInputSchema,
});

export const courseBuilderSchema = z.object({
	title: textField(3, 255),
	description: z.string().trim().max(4000).optional().default(""),
	category: textField(1, 100),
	topics: z.array(courseTopicInputSchema).min(1).max(100),
});

export const adminCreateUserSchema = z.object({
	name: z.string().trim().min(2).max(100).optional().or(z.literal("")),
	email: z.string().trim().email().max(255),
	password: z
		.string()
		.min(8)
		.max(128)
		.regex(/[A-Z]/, "Password must include an uppercase letter.")
		.regex(/[a-z]/, "Password must include a lowercase letter.")
		.regex(/[0-9]/, "Password must include a number."),
	role: roleSchema,
	canApproveOnsiteTraining: z.coerce.boolean().default(false),
	supervisorId: z.string().min(1).optional().nullable().or(z.literal("")),
});

export const adminUpdateUserSchema = z.object({
	name: z.string().trim().min(2).max(100).optional().or(z.literal("")),
	role: roleSchema,
	canApproveOnsiteTraining: z.coerce.boolean().default(false),
	supervisorId: z.string().min(1).optional().nullable().or(z.literal("")),
});

export type CourseBuilderInput = z.infer<typeof courseBuilderSchema>;
export type QuizQuestionInput = z.infer<typeof quizQuestionInputSchema>;
