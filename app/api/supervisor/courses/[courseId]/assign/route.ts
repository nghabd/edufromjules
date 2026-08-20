import { NextResponse } from "next/server";
import { badRequest, requireRole, serverError } from "@/lib/api-auth";
import { enforceTrustedOrigin } from "@/lib/request-security";
import {
	assignCourseToPharmacists,
	AssignCourseError,
} from "@/lib/course-assign";
import { z } from "zod";

const assignPayloadSchema = z.object({
	userIds: z.array(z.string().min(1)).min(0).max(200).optional(),
	pharmacistIds: z.array(z.string().min(1)).min(0).max(200).optional(),
	dueDate: z
		.string()
		.datetime()
		.optional()
		.or(z.null())
		.or(z.literal("")),
	sendEmails: z.boolean().optional().default(false),
});

type RouteContext = {
	params: Promise<{ courseId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const { courseId } = await context.params;

		const body = await req.json().catch(() => null);
		const parsed = assignPayloadSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid assignment payload.", parsed.error.flatten());
		}

		const userIds = parsed.data.userIds ?? parsed.data.pharmacistIds ?? [];
		const dueDate = parsed.data.dueDate
			? new Date(parsed.data.dueDate)
			: null;

		if (dueDate && Number.isNaN(dueDate.getTime())) {
			return badRequest("Invalid deadline date.");
		}
		if (dueDate && dueDate.getTime() <= Date.now()) {
			return badRequest("Deadline must be in the future.");
		}

		const result = await assignCourseToPharmacists({
			courseId,
			pharmacistIds: userIds,
			dueDate,
			assignedById: session.user.id,
			actorRole: session.user.role === "ADMIN" ? "ADMIN" : "SUPERVISOR",
			sendEmails: parsed.data.sendEmails,
		});

		return NextResponse.json({ ...result, message: "Course assigned successfully" }, { status: 201 });
	} catch (err) {
		if (err instanceof AssignCourseError) {
			return NextResponse.json({ message: err.message }, { status: err.status });
		}
		console.error("[ASSIGN_COURSE_ERROR]", err);
		return serverError("Failed to assign course.");
	}
}