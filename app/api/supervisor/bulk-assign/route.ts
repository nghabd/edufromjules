import { NextResponse } from "next/server";
import { badRequest, requireSupervisor, serverError } from "@/lib/api-auth";
import { enforceTrustedOrigin } from "@/lib/request-security";
import {
	assignCourseToPharmacists,
	AssignCourseError,
} from "@/lib/course-assign";
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

		const { courseId, pharmacistIds } = parsed.data;
		const dueDate =
			parsed.data.dueDate && parsed.data.dueDate !== ""
				? new Date(parsed.data.dueDate)
				: null;

		const result = await assignCourseToPharmacists({
			courseId,
			pharmacistIds,
			dueDate,
			assignedById: session.user.id,
			actorRole: session.user.role === "ADMIN" ? "ADMIN" : "SUPERVISOR",
			sendEmails: true,
		});

		return NextResponse.json(result);
	} catch (err) {
		if (err instanceof AssignCourseError) {
			return badRequest(err.message);
		}
		return serverError("Failed to bulk assign course");
	}
}