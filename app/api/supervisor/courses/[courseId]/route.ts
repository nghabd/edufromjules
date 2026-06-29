import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { courseBuilderSchema, type CourseBuilderInput } from "@/lib/schemas";
import {
	buildLessonQuizWriteData,
	buildMaterialWriteData,
	buildQuestionWriteData,
	courseResponseInclude,
} from "@/lib/course-payload";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

type TransactionClient = Prisma.TransactionClient;
type CourseTopicInput = CourseBuilderInput["topics"][number];
type CourseMaterialInput = CourseTopicInput["materials"][number];
type LessonQuizInput = NonNullable<CourseTopicInput["quiz"]>;

async function syncMaterials(
	tx: TransactionClient,
	topicId: string,
	materials: CourseMaterialInput[],
) {
	const existingMaterials = await tx.material.findMany({
		where: { topicId },
		select: { id: true },
	});
	const existingMaterialIds = new Set(
		existingMaterials.map((material) => material.id),
	);
	const keptMaterialIds = new Set<string>();

	for (const [index, material] of materials.entries()) {
		const materialData = buildMaterialWriteData(material, index);
		const materialId = material.id;
		const canUpdateExisting = materialId
			? existingMaterialIds.has(materialId)
			: false;

		if (canUpdateExisting && materialId) {
			await tx.material.update({
				where: { id: materialId },
				data: materialData,
			});
			keptMaterialIds.add(materialId);
			continue;
		}

		const createdMaterial = await tx.material.create({
			data: { ...materialData, topicId },
			select: { id: true },
		});
		keptMaterialIds.add(createdMaterial.id);
	}

	const removedMaterialIds = [...existingMaterialIds].filter(
		(id) => !keptMaterialIds.has(id),
	);
	if (removedMaterialIds.length > 0) {
		await tx.material.deleteMany({
			where: { id: { in: removedMaterialIds }, topicId },
		});
	}
}

async function syncQuestions(
	tx: TransactionClient,
	quizId: string,
	questions: LessonQuizInput["questions"],
) {
	const existingQuestions = await tx.question.findMany({
		where: { quizId },
		select: { id: true },
	});
	const existingQuestionIds = new Set(
		existingQuestions.map((question) => question.id),
	);
	const keptQuestionIds = new Set<string>();

	for (const [index, question] of questions.entries()) {
		const questionData = buildQuestionWriteData(question, index);
		const questionId = question.id;
		const canUpdateExisting = questionId
			? existingQuestionIds.has(questionId)
			: false;

		if (canUpdateExisting && questionId) {
			await tx.question.update({
				where: { id: questionId },
				data: questionData,
			});
			keptQuestionIds.add(questionId);
			continue;
		}

		const createdQuestion = await tx.question.create({
			data: { ...questionData, quizId },
			select: { id: true },
		});
		keptQuestionIds.add(createdQuestion.id);
	}

	const removedQuestionIds = [...existingQuestionIds].filter(
		(id) => !keptQuestionIds.has(id),
	);
	if (removedQuestionIds.length > 0) {
		await tx.question.deleteMany({
			where: { id: { in: removedQuestionIds }, quizId },
		});
	}
}

async function syncRequiredQuiz(
	tx: TransactionClient,
	topicId: string,
	quiz: CourseTopicInput["quiz"],
) {
	const existingQuiz = await tx.quiz.findUnique({
		where: { topicId },
		select: { id: true },
	});

	if (!quiz) {
		if (existingQuiz) {
			await tx.quiz.delete({ where: { id: existingQuiz.id } });
		}
		return;
	}

	const quizData = buildLessonQuizWriteData(quiz);
	const quizId = existingQuiz
		? (
				await tx.quiz.update({
					where: { id: existingQuiz.id },
					data: quizData,
					select: { id: true },
				})
			).id
		: (
				await tx.quiz.create({
					data: { ...quizData, topicId },
					select: { id: true },
				})
			).id;

	await syncQuestions(tx, quizId, quiz.questions);
}

async function syncCourseTopics(
	tx: TransactionClient,
	courseId: string,
	topics: CourseBuilderInput["topics"],
) {
	const existingTopics = await tx.topic.findMany({
		where: { courseId },
		select: { id: true },
	});
	const existingTopicIds = new Set(existingTopics.map((topic) => topic.id));
	const keptTopicIds = new Set<string>();

	for (const [index, topic] of topics.entries()) {
		const topicData = {
			title: topic.title,
			description: topic.description || "",
			order: index + 1,
		};
		const incomingTopicId = topic.id;
		const canUpdateExisting = incomingTopicId
			? existingTopicIds.has(incomingTopicId)
			: false;

		const topicId =
			canUpdateExisting && incomingTopicId
				? (
						await tx.topic.update({
							where: { id: incomingTopicId },
							data: topicData,
							select: { id: true },
						})
					).id
				: (
						await tx.topic.create({
							data: { ...topicData, courseId },
							select: { id: true },
						})
					).id;

		keptTopicIds.add(topicId);
		await syncMaterials(tx, topicId, topic.materials);
		await syncRequiredQuiz(tx, topicId, topic.quiz);
	}

	const removedTopicIds = [...existingTopicIds].filter(
		(id) => !keptTopicIds.has(id),
	);
	if (removedTopicIds.length > 0) {
		await tx.topic.deleteMany({
			where: { id: { in: removedTopicIds }, courseId },
		});
	}
}

async function ensureAssignedMaterialProgress(
	tx: TransactionClient,
	courseId: string,
) {
	const [assignments, materials] = await Promise.all([
		tx.courseAssignment.findMany({
			where: { courseId },
			select: { pharmacistId: true },
		}),
		tx.material.findMany({
			where: { topic: { courseId } },
			select: { id: true },
		}),
	]);

	if (assignments.length === 0 || materials.length === 0) return;

	const rows = assignments.flatMap((assignment) =>
		materials.map((material) => ({
			userId: assignment.pharmacistId,
			materialId: material.id,
		})),
	);

	for (let index = 0; index < rows.length; index += 1000) {
		await tx.userProgress.createMany({
			data: rows.slice(index, index + 1000),
			skipDuplicates: true,
		});
	}
}

export async function PATCH(
	req: Request,
	context: { params: Promise<{ courseId: string }> },
) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const { courseId } = await context.params;
		const body = await req.json().catch(() => null);
		const parsed = courseBuilderSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid course payload.", parsed.error.flatten());
		}

		const updatedCourse = await prisma.$transaction(async (tx) => {
			await tx.course.update({
				where: { id: courseId },
				data: {
					title: parsed.data.title,
					description: parsed.data.description,
					category: parsed.data.category,
				},
			});

			await syncCourseTopics(tx, courseId, parsed.data.topics);
			await ensureAssignedMaterialProgress(tx, courseId);

			return tx.course.findUniqueOrThrow({
				where: { id: courseId },
				include: courseResponseInclude,
			});
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.adminChanged,
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.courseChanged,
		]);

		return NextResponse.json(updatedCourse, { status: 200 });
	} catch (err) {
		console.error("[COURSE_UPDATE_ERROR]", err);
		return serverError("Failed to update course");
	}
}

export async function DELETE(
	req: Request,
	context: { params: Promise<{ courseId: string }> },
) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;
		const { courseId } = await context.params;

		await prisma.course.delete({ where: { id: courseId } });
		await publishDashboardRefresh([
			REALTIME_EVENTS.adminChanged,
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.courseChanged,
		]);
		return NextResponse.json({ message: "Course deleted" }, { status: 200 });
	} catch {
		return serverError("Failed to delete course");
	}
}
