import { NextResponse } from "next/server";
import { badRequest, requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { issueCourseCertificateIfComplete } from "@/lib/certificates";

function supervisedPharmacistWhere(userId: string, role: string) {
	return role === "SUPERVISOR"
		? {
				role: "PHARMACIST",
				OR: [{ supervisorId: userId }, { group: { supervisorId: userId } }],
			}
		: { role: "PHARMACIST" };
}

export async function GET() {
	const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
	if (error) return error;

	const progressRecords = await prisma.userProgress.findMany({
		where: {
			user: supervisedPharmacistWhere(session.user.id, session.user.role),
			material: { type: "PRACTICAL" },
		},
		include: {
			user: { select: { id: true, name: true, email: true } },
			material: {
				select: {
					id: true,
					title: true,
					topic: {
						select: {
							title: true,
							course: { select: { id: true, title: true } },
						},
					},
				},
			},
		},
		orderBy: [{ completed: "asc" }, { lastAccessed: "desc" }],
	});

	const approverIds = [
		...new Set(
			progressRecords
				.map((record) => record.approvedBy)
				.filter((id): id is string => Boolean(id)),
		),
	];
	const approvers = approverIds.length
		? await prisma.user.findMany({
				where: { id: { in: approverIds } },
				select: { id: true, name: true, email: true },
			})
		: [];
	const approverById = new Map(approvers.map((user) => [user.id, user]));

	return NextResponse.json({
		onsiteTraining: progressRecords.map((record) => ({
			id: record.id,
			status: record.completed ? "APPROVED" : record.completionStatus,
			completed: record.completed,
			approvedAt: record.approvedAt,
			lastAccessed: record.lastAccessed,
			pharmacist: record.user,
			task: {
				id: record.material.id,
				title: record.material.title,
				lesson: record.material.topic.title,
				courseId: record.material.topic.course.id,
				courseTitle: record.material.topic.course.title,
			},
			approvedBy: record.approvedBy
				? (approverById.get(record.approvedBy) ?? null)
				: null,
		})),
	});
}

export async function PATCH(req: Request) {
	const originError = enforceTrustedOrigin(req);
	if (originError) return originError;

	const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
	if (error) return error;

	const body = await req.json().catch(() => null);
	const progressId = String(body?.progressId ?? "");
	if (!progressId) return badRequest("Progress ID is required");

		const progressRecord = await prisma.userProgress.findFirst({
			where: {
				id: progressId,
				user: supervisedPharmacistWhere(session.user.id, session.user.role),
				material: { type: "PRACTICAL" },
			},
			select: {
				id: true,
				userId: true,
				material: { select: { topic: { select: { courseId: true } } } },
			},
		});

	if (!progressRecord) {
		return NextResponse.json(
			{ message: "Onsite training record not found." },
			{ status: 404 },
		);
	}

	const updatedProgress = await prisma.userProgress.update({
		where: { id: progressId },
		data: {
			completed: true,
			progress: 100,
			completionStatus: "APPROVED",
			approvedBy: session.user.id,
			approvedAt: new Date(),
		},
	});

		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.progressChanged,
			REALTIME_EVENTS.practicalApproved,
		]);
		await issueCourseCertificateIfComplete(
			progressRecord.userId,
			progressRecord.material.topic.courseId,
		).catch((error) => {
			console.error("[CERTIFICATE_ONSITE_APPROVAL_FAILED]", error);
		});

		return NextResponse.json({ progress: updatedProgress });
}
