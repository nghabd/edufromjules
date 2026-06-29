import { NextResponse } from "next/server";
import { badRequest, requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { createQuizSchema } from "@/lib/schemas";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export async function POST(req: Request) {
  const originError = enforceTrustedOrigin(req);
  if (originError) return originError;

  const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createQuizSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid quiz payload.");

  const courseId = parsed.data.courseId;
  const topicId = parsed.data.topicId ?? null;
  const scope = topicId ? "LESSON" : "COURSE";
  const title = parsed.data.title.trim() || (scope === "LESSON" ? "Lesson quiz" : "Course quiz");
  const question = parsed.data.question.trim();
  const type = parsed.data.type;
  const options = parsed.data.options.map((option) => option.trim()).filter(Boolean);
  const correctAnswers = parsed.data.correctAnswers.map((option) => option.trim()).filter(Boolean);

  if (!courseId) return badRequest("Course is required.");
  if (question.length < 5) return badRequest("Question is required.");
  if (!correctAnswers.length) return badRequest("Set a correct answer.");

  let normalizedOptions: string[] = [];
  let normalizedCorrectAnswers: string[] = [];

  if (type === "TRUE_FALSE") {
    normalizedOptions = ["True", "False"];
    if (correctAnswers.length !== 1) return badRequest("True/False questions accept exactly one correct answer.");
    const normalized = correctAnswers[0].toLowerCase();
    if (normalized !== "true" && normalized !== "false") {
      return badRequest("True/False answer must be either True or False.");
    }
    normalizedCorrectAnswers = [normalized === "true" ? "True" : "False"];
  } else if (type === "COMPLETE") {
    if (correctAnswers.length !== 1) return badRequest("Complete-the-blank questions accept exactly one answer.");
    normalizedOptions = [];
    normalizedCorrectAnswers = [correctAnswers[0]];
  } else if (type === "MULTI_SELECT") {
    if (options.length < 2) return badRequest("Multi-select questions need at least two options.");
    const optionsSet = new Set(options);
    if (optionsSet.size !== options.length) return badRequest("Duplicate options are not allowed.");
    if (!correctAnswers.every((answer) => optionsSet.has(answer))) {
      return badRequest("Each correct answer must match one of the provided options.");
    }
    normalizedOptions = options;
    normalizedCorrectAnswers = [...new Set(correctAnswers)];
  } else {
    if (options.length < 2) return badRequest("Add at least two options.");
    if (correctAnswers.length !== 1) return badRequest("Single-choice questions accept exactly one correct answer.");
    if (!options.includes(correctAnswers[0])) {
      return badRequest("Correct answer must match one of the provided options.");
    }
    normalizedOptions = options;
    normalizedCorrectAnswers = [correctAnswers[0]];
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });

  if (topicId) {
    const topic = await prisma.topic.findFirst({ where: { id: topicId, courseId } });
    if (!topic) return NextResponse.json({ message: "Lesson not found." }, { status: 404 });
  }

  const existingQuiz = await prisma.quiz.findFirst({
    where: topicId
      ? { topicId }
      : {
          courseId,
          scope: "COURSE",
          topicId: null,
        },
    include: { questions: true },
  });

  const nextOrder = (existingQuiz?.questions.length ?? 0) + 1;

  const quiz = existingQuiz
    ? await prisma.quiz.update({
        where: { id: existingQuiz.id },
        data: {
          title,
          scope,
          courseId,
          topicId,
          questions: {
            create: {
              question,
              type,
              options: JSON.stringify(normalizedOptions),
              correctAnswer: JSON.stringify(normalizedCorrectAnswers),
              order: nextOrder,
            },
          },
        },
        include: { questions: { orderBy: { order: "asc" } } },
      })
    : await prisma.quiz.create({
        data: {
          title,
          scope,
          courseId,
          topicId,
          questions: {
            create: {
              question,
              type,
              options: JSON.stringify(normalizedOptions),
              correctAnswer: JSON.stringify(normalizedCorrectAnswers),
              order: 1,
            },
          },
        },
        include: { questions: { orderBy: { order: "asc" } } },
      });

  await publishDashboardRefresh([
    REALTIME_EVENTS.supervisorChanged,
    REALTIME_EVENTS.pharmacistChanged,
    REALTIME_EVENTS.courseChanged,
  ]);

  return NextResponse.json(quiz, { status: 201 });
}
