import { prisma } from "@/lib/prisma";

export async function findAccessibleMaterial(materialId: string, userId: string, role: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      topic: {
        include: {
          course: {
            include: {
              assignments: true,
              groups: true,
            },
          },
        },
      },
    },
  });

  if (!material) return null;

  const canAccess =
    role === "ADMIN" ||
    material.topic.course.assignments.some(
      (assignment) => assignment.pharmacistId === userId || assignment.assignedById === userId,
    ) ||
    material.topic.course.groups.some((group) => group.supervisorId === userId);

  return canAccess ? material : null;
}
