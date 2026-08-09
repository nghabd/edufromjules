import { NextResponse } from "next/server";
import { badRequest, requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendAssignmentEmail } from "@/lib/mail";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { assignCourseSchema } from "@/lib/schemas";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export async function POST(req: Request) {
  const originError = enforceTrustedOrigin(req);
  if (originError) return originError;

  const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = assignCourseSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid assignment payload.");

  const courseId = parsed.data.courseId;
  const pharmacistId = parsed.data.pharmacistId;
  const dueDate = parsed.data.dueDate ? new Date(String(parsed.data.dueDate)) : null;

  if (!courseId || !pharmacistId) return badRequest("Course and pharmacist are required.");
  if (dueDate && Number.isNaN(dueDate.getTime())) return badRequest("Invalid due date.");

  const pharmacist = await prisma.user.findFirst({
    where: {
      id: pharmacistId,
      role: "PHARMACIST",
      ...(session.user.role === "SUPERVISOR"
        ? { OR: [{ supervisorId: session.user.id }, { group: { supervisorId: session.user.id } }] }
        : {}),
    },
  });
  if (!pharmacist) return NextResponse.json({ message: "Pharmacist not found." }, { status: 404 });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { topics: { include: { materials: true } } },
  });
  if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });

  const assignment = await prisma.courseAssignment.upsert({
    where: { courseId_pharmacistId: { courseId, pharmacistId } },
    update: { dueDate, assignedById: session.user.id, status: "ASSIGNED" },
    create: { courseId, pharmacistId, assignedById: session.user.id, dueDate },
  });

  const materials = course.topics.flatMap((topic) => topic.materials);
  await prisma.$transaction(
    materials.map((material) =>
      prisma.userProgress.upsert({
        where: { userId_materialId: { userId: pharmacistId, materialId: material.id } },
        update: {},
        create: { userId: pharmacistId, materialId: material.id },
      }),
    ),
  );

  await prisma.notification.create({
    data: {
      userId: pharmacistId,
      title: "New course assigned",
      message: `${course.title} has been assigned to you.`,
      type: "INFO",
    },
  });

  await sendAssignmentEmail({
    to: pharmacist.email,
    pharmacistName: pharmacist.name,
    courseTitle: course.title,
    dueDate,
  });

  await publishDashboardRefresh([
    REALTIME_EVENTS.supervisorChanged,
    REALTIME_EVENTS.pharmacistChanged,
    REALTIME_EVENTS.assignmentChanged,
  ]);

  return NextResponse.json(assignment);
}
