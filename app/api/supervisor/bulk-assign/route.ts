import { NextResponse } from "next/server";
import { requireSupervisor, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendAssignmentEmail } from "@/lib/mail";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { z } from "zod";

const bulkAssignSchema = z.object({
	courseId: z.string().min(1),
	pharmacistIds: z.array(z.string().min(1)).min(1).max(100),
	dueDate: z.string().datetime().optional().or(z.null()).or(z.literal("")),
});

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireSupervisor();
		if (error) return error;

		const body = await req.json().catch(() => null);
		const parsed = bulkAssignSchema.safeParse(body);
		if (!parsed.success) return badRequest("Invalid bulk assignment payload");

		const { courseId, pharmacistIds, dueDate } = parsed.data;
		const parsedDueDate =
			dueDate && dueDate !== "" ? new Date(dueDate) : null;

		const course = await prisma.course.findUnique({
			where: { id: courseId },
			include: { topics: { include: { materials: { select: { id: true } } } } },
		});
		if (!course) return NextResponse.json({ message: "Course not found" }, { status: 404 });

		// Verify all pharmacists are under this supervisor
		const pharmacists = await prisma.user.findMany({
			where: {
				id: { in: pharmacistIds },
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
			select: { id: true, email: true, name: true },
		});

		if (pharmacists.length === 0)
			return badRequest("No valid pharmacists found");

		const materials = course.topics.flatMap((t) => t.materials);
		const results = { assigned: 0, skipped: 0 };

		await prisma.$transaction(async (tx) => {
			for (const pharmacist of pharmacists) {
				await tx.courseAssignment.upsert({
					where: {
						courseId_pharmacistId: {
							courseId,
							pharmacistId: pharmacist.id,
						},
					},
					update: {
						dueDate: parsedDueDate,
						assignedById: session.user.id,
						status: "ASSIGNED",
					},
					create: {
						courseId,
						pharmacistId: pharmacist.id,
						assignedById: session.user.id,
						dueDate: parsedDueDate,
					},
				});

				for (const material of materials) {
					await tx.userProgress.upsert({
						where: {
							userId_materialId: {
								userId: pharmacist.id,
								materialId: material.id,
							},
						},
						update: {},
						create: { userId: pharmacist.id, materialId: material.id },
					});
				}

				await tx.notification.create({
					data: {
						userId: pharmacist.id,
						title: "New course assigned",
						message: `"${course.title}" has been assigned to you.`,
						type: "INFO",
					},
				});

				results.assigned++;
			}
		});

		// Send emails in background (non-blocking)
		void Promise.all(
			pharmacists.map((p) =>
				sendAssignmentEmail({
					to: p.email,
					pharmacistName: p.name,
					courseTitle: course.title,
					dueDate: parsedDueDate,
				}),
			),
		);

		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.assignmentChanged,
		]);

		return NextResponse.json({ ...results, total: pharmacists.length });
	} catch {
		return serverError("Failed to bulk assign course");
	}
}
