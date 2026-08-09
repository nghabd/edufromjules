import { NextResponse } from "next/server";
import { requireRole, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { assignCoursesSchema } from "@/lib/schemas";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const body = await req.json().catch(() => null);
		const parsed = assignCoursesSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid assignment payload.", parsed.error.flatten());
		}

		const { courseId, userIds } = parsed.data;
		const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
		const uniqueUserIds = [...new Set(userIds)];

		const course = await prisma.course.findUnique({
			where: { id: courseId },
			include: { topics: { include: { materials: true } } },
		});
		if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });

		const pharmacists = await prisma.user.findMany({
			where: {
				id: { in: uniqueUserIds },
				role: "PHARMACIST",
				...(session.user.role === "SUPERVISOR"
					? {
							OR: [
								{ supervisorId: session.user.id },
								{ group: { supervisorId: session.user.id } },
							],
						}
					: {}),
			},
			select: { id: true },
		});

		if (pharmacists.length !== uniqueUserIds.length) {
			return badRequest("One or more selected pharmacists are unavailable.");
		}

		const materialIds = course.topics.flatMap((topic) =>
			topic.materials.map((material) => material.id),
		);

		await prisma.$transaction(async (tx) => {
			for (const pharmacistId of uniqueUserIds) {
				await tx.courseAssignment.upsert({
					where: { courseId_pharmacistId: { courseId, pharmacistId } },
					update: { assignedById: session.user.id, dueDate, status: "ASSIGNED" },
					create: {
						courseId,
						pharmacistId,
						assignedById: session.user.id,
						dueDate,
					},
				});

				for (const materialId of materialIds) {
					await tx.userProgress.upsert({
						where: { userId_materialId: { userId: pharmacistId, materialId } },
						update: {},
						create: { userId: pharmacistId, materialId },
					});
				}

				await tx.notification.create({
					data: {
						userId: pharmacistId,
						title: "New course assigned",
						message: `${course.title} has been assigned to you.`,
						type: "INFO",
					},
				});
			}
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.assignmentChanged,
		]);

		return NextResponse.json(
			{ message: "Course assigned successfully" },
			{ status: 201 },
		);
	} catch (err) {
		console.error("[ASSIGNMENT_ERROR]", err);
		return serverError("Failed to assign course.");
	}
}
