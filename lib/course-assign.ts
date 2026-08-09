// Shared course assignment workflow. All assign entry points
// (`/api/supervisor/courses/[courseId]/assign`, the legacy `/api/supervisor/assignments`,
// `/api/supervisor/bulk-assign` and `/api/supervisor/assign-course`) funnel through here.

import { prisma } from "@/lib/prisma";
import { sendAssignmentEmail } from "@/lib/mail";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export class AssignCourseError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "AssignCourseError";
		this.status = status;
	}
}

type AssignCourseInput = {
	courseId: string;
	pharmacistIds: string[];
	dueDate?: Date | null;
	assignedById: string;
	actorRole: "SUPERVISOR" | "ADMIN";
	sendEmails?: boolean;
};

export type AssignCourseResult = {
	assigned: number;
	skipped: number;
	total: number;
};

export async function assignCourseToPharmacists(
	params: AssignCourseInput,
): Promise<AssignCourseResult> {
	const {
		courseId,
		pharmacistIds,
		dueDate = null,
		assignedById,
		actorRole,
		sendEmails = false,
	} = params;

	const uniqueIds = [...new Set(pharmacistIds)];
	if (uniqueIds.length === 0) {
		throw new AssignCourseError("No pharmacists selected.");
	}

	const course = await prisma.course.findUnique({
		where: { id: courseId },
		include: {
			topics: { include: { materials: { select: { id: true } } } },
		},
	});
	if (!course) throw new AssignCourseError("Course not found.", 404);

	const pharmacists = await prisma.user.findMany({
		where: {
			id: { in: uniqueIds },
			role: "PHARMACIST",
			...(actorRole === "SUPERVISOR"
				? {
						OR: [
							{ supervisorId: assignedById },
							{ group: { supervisorId: assignedById } },
						],
					}
				: {}),
		},
		select: { id: true, email: true, name: true },
	});

	if (pharmacists.length === 0) {
		throw new AssignCourseError("No valid pharmacists found.");
	}

	if (pharmacists.length !== uniqueIds.length) {
		throw new AssignCourseError("One or more selected pharmacists are unavailable.");
	}

	const materials = course.topics.flatMap((topic) => topic.materials);
	let assigned = 0;

	await prisma.$transaction(async (tx) => {
		for (const pharmacist of pharmacists) {
			await tx.courseAssignment.upsert({
				where: {
					courseId_pharmacistId: { courseId, pharmacistId: pharmacist.id },
				},
				update: { dueDate, assignedById, status: "ASSIGNED" },
				create: { courseId, pharmacistId: pharmacist.id, assignedById, dueDate },
			});

			for (const material of materials) {
				await tx.userProgress.upsert({
					where: {
						userId_materialId: { userId: pharmacist.id, materialId: material.id },
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

			assigned++;
		}
	});

	if (sendEmails) {
		void Promise.all(
			pharmacists.map((pharmacist) =>
				sendAssignmentEmail({
					to: pharmacist.email,
					pharmacistName: pharmacist.name,
					courseTitle: course.title,
					dueDate,
				}),
			),
		);
	}

	await publishDashboardRefresh([
		REALTIME_EVENTS.supervisorChanged,
		REALTIME_EVENTS.pharmacistChanged,
		REALTIME_EVENTS.assignmentChanged,
	]);

	return {
		assigned,
		skipped: uniqueIds.length - assigned,
		total: uniqueIds.length,
	};
}