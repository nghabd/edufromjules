import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 25)));
  const skip = (page - 1) * pageSize;

  const pharmacists = await prisma.user.findMany({
    where: {
      role: "PHARMACIST",
      ...(session.user.role === "SUPERVISOR"
        ? { OR: [{ supervisorId: session.user.id }, { group: { supervisorId: session.user.id } }] }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: search } },
                  { email: { contains: search } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      updatedAt: true,
      courseAssignments: {
        select: {
          id: true,
          course: {
            select: {
              topics: {
                select: {
                  materials: { select: { id: true } },
                },
              },
            },
          },
        },
      },
      progress: {
        select: {
          materialId: true,
          completed: true,
          completionStatus: true,
        },
      },
    },
    orderBy: { name: "asc" },
    skip,
    take: pageSize,
  });

  return NextResponse.json(
    pharmacists.map((pharmacist) => {
      const assignedMaterials = pharmacist.courseAssignments.flatMap((assignment) =>
        assignment.course.topics.flatMap((topic) => topic.materials),
      );
      const completed = assignedMaterials.filter((material) =>
        pharmacist.progress.some((item) => item.materialId === material.id && item.completed),
      ).length;

      return {
        id: pharmacist.id,
        name: pharmacist.name,
        email: pharmacist.email,
        progress: assignedMaterials.length ? Math.round((completed / assignedMaterials.length) * 100) : 0,
        completedCourses: pharmacist.courseAssignments.filter((assignment) =>
          assignment.course.topics
            .flatMap((topic) => topic.materials)
            .every((material) =>
              pharmacist.progress.some((item) => item.materialId === material.id && item.completed),
            ),
        ).length,
        totalCourses: pharmacist.courseAssignments.length,
        lastActive: pharmacist.updatedAt,
        status: "OFFLINE",
        pendingApprovals: pharmacist.progress.filter((item) => item.completionStatus === "PENDING").length,
      };
    }),
  );
}
