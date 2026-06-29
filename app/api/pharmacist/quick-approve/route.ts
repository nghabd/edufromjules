import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { badRequest, forbidden } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin, getClientIp } from "@/lib/request-security";
import { publishDashboardRefresh, publishRealtimeEvent } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { issueCourseCertificateIfComplete } from "@/lib/certificates";

type TrainerContext = {
	id: string;
	role: string;
	canApproveOnsiteTraining: boolean;
	supervisorId: string | null;
	groupId: string | null;
};

type TraineeContext = {
	id: string;
	supervisorId: string | null;
	groupId: string | null;
	group: { supervisorId: string } | null;
};

function canApproveOnsiteTraining(
	trainer: TrainerContext,
	trainee: TraineeContext,
) {
	if (trainer.role === "ADMIN") return true;

	if (trainer.role === "SUPERVISOR") {
		return (
			trainee.supervisorId === trainer.id ||
			trainee.group?.supervisorId === trainer.id
		);
	}

	return (
		trainer.role === "PHARMACIST" &&
		trainer.canApproveOnsiteTraining &&
		trainer.id !== trainee.id &&
		((Boolean(trainer.groupId) && trainer.groupId === trainee.groupId) ||
			(Boolean(trainer.supervisorId) &&
				trainer.supervisorId === trainee.supervisorId))
	);
}

export async function POST(req: Request) {
	const originError = enforceTrustedOrigin(req);
	if (originError) return originError;

	const ip = getClientIp(req);
	const limit = await rateLimit(`quick-approve:${ip}`, {
		windowMs: 15 * 60 * 1000,
		maxRequests: 8,
	});
	if (!limit.success) {
		return NextResponse.json(
			{
				message: "Too many approval attempts. Please try again later.",
				resetIn: limit.resetIn,
			},
			{
				status: 429,
				headers: limit.resetIn
					? { "Retry-After": String(limit.resetIn) }
					: undefined,
			},
		);
	}

	const body = await req.json().catch(() => null);
	if (!body || !body.progressId || !body.expertEmail || !body.expertPassword) {
		return badRequest("Missing required fields");
	}

	try {
		const expert = await prisma.user.findUnique({
			where: { email: body.expertEmail },
			select: {
				id: true,
				email: true,
				name: true,
				password: true,
				role: true,
				canApproveOnsiteTraining: true,
				supervisorId: true,
				groupId: true,
			},
		});
		if (!expert || !expert.password)
			return badRequest("Invalid expert credentials");
		if (!["PHARMACIST", "SUPERVISOR", "ADMIN"].includes(expert.role)) {
			return forbidden("This account cannot approve onsite training.");
		}
		if (
			expert.role === "PHARMACIST" &&
			!expert.canApproveOnsiteTraining
		) {
			return forbidden(
				"This pharmacist is not marked as an onsite trainer.",
			);
		}

		const isPasswordValid = await bcrypt.compare(
			body.expertPassword,
			expert.password,
		);
		if (!isPasswordValid) return badRequest("Invalid expert credentials");

		const progressRecord = await prisma.userProgress.findUnique({
			where: { id: body.progressId },
			include: {
				material: {
					select: {
						id: true,
						type: true,
						title: true,
						topic: { select: { courseId: true } },
					},
				},
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						supervisorId: true,
						groupId: true,
						group: { select: { supervisorId: true } },
					},
				},
			},
		});

		if (!progressRecord) return badRequest("Onsite training record not found");
		if (progressRecord.material.type !== "PRACTICAL") {
			return badRequest("This record is not an onsite training task");
		}
		if (progressRecord.userId === expert.id) {
			return forbidden("You cannot approve your own onsite training.");
		}
		if (!canApproveOnsiteTraining(expert, progressRecord.user)) {
			return forbidden(
				"This trainer account cannot approve this assigned pharmacist.",
			);
		}
		if (progressRecord.completed) {
			return NextResponse.json({
				message: "Onsite training already approved",
				expertName: expert.name,
			});
		}

		const updatedProgress = await prisma.userProgress.update({
			where: { id: body.progressId },
			data: {
				completed: true,
				progress: 100,
				completionStatus: "APPROVED",
				approvedBy: expert.id,
				approvedAt: new Date(),
			},
		});

		await publishRealtimeEvent(REALTIME_EVENTS.practicalApproved, {
			progressId: updatedProgress.id,
			userId: updatedProgress.userId,
		});
		await publishDashboardRefresh([
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.pharmacistChanged,
			REALTIME_EVENTS.progressChanged,
			REALTIME_EVENTS.practicalApproved,
		]);
		await issueCourseCertificateIfComplete(
			updatedProgress.userId,
			progressRecord.material.topic.courseId,
		).catch((error) => {
			console.error("[CERTIFICATE_QUICK_APPROVAL_FAILED]", error);
		});

		return NextResponse.json({
			message: "Approved successfully",
			expertName: expert.name,
		});
	} catch (error) {
		console.error("[QUICK_APPROVE_ERROR]", error);
		return NextResponse.json({ message: "Failed to approve" }, { status: 500 });
	}
}
