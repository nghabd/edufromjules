import { NextResponse } from "next/server";
import { requireRole, badRequest } from "@/lib/api-auth";
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

export async function POST(req: Request) {
	const originError = enforceTrustedOrigin(req);
	if (originError) return originError;

	const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
	if (error) return error;

	const body = await req.json().catch(() => null);
	if (!body || !body.progressId) {
		return badRequest("Progress ID is required");
	}

	try {
		const progressRecord = await prisma.userProgress.findFirst({
			where: {
				id: body.progressId,
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
			where: { id: body.progressId },
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
			console.error("[CERTIFICATE_APPROVAL_FAILED]", error);
		});

		return NextResponse.json({
			message: "Practical training approved successfully",
			progress: updatedProgress,
		});
	} catch (err) {
		console.error("[APPROVAL_ERROR]", err);
		return NextResponse.json(
			{ message: "Failed to approve training" },
			{ status: 500 },
		);
	}
}
