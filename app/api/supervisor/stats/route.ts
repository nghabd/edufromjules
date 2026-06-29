import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
  if (error) return error;

  const pharmacistWhere =
    session.user.role === "SUPERVISOR"
      ? { role: "PHARMACIST", OR: [{ supervisorId: session.user.id }, { group: { supervisorId: session.user.id } }] }
      : { role: "PHARMACIST" };

  const pharmacists = await prisma.user.findMany({
    where: pharmacistWhere,
    select: {
      id: true,
      courseAssignments: {
        select: {
          course: {
            select: {
              topics: {
                select: { materials: { select: { id: true } } },
              },
            },
          },
        },
      },
      progress: {
        select: { materialId: true, completed: true },
      },
    },
  });

  const progressValues = pharmacists.map((pharmacist) => {
    const materials = pharmacist.courseAssignments.flatMap((assignment) =>
      assignment.course.topics.flatMap((topic) => topic.materials),
    );
    if (!materials.length) return 0;
    const completed = materials.filter((material) =>
      pharmacist.progress.some((item) => item.materialId === material.id && item.completed),
    ).length;
    return Math.round((completed / materials.length) * 100);
  });

  const overdueAssignments = await prisma.courseAssignment.count({
    where: {
      ...(session.user.role === "SUPERVISOR" ? { assignedById: session.user.id } : {}),
      dueDate: { lt: new Date() },
      status: { not: "COMPLETED" },
    },
  });

  const averageProgress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : 0;

  return NextResponse.json({
    totalPharmacists: pharmacists.length,
    averageProgress,
    completionRate: progressValues.length
      ? Math.round((progressValues.filter((value) => value === 100).length / progressValues.length) * 100)
      : 0,
    overdueAssignments,
  });
}
