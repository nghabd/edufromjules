import { NextResponse } from "next/server";
import { badRequest, requireRole, serverError } from "@/lib/api-auth";
import { enforceTrustedOrigin } from "@/lib/request-security";
import {
	assignCourseToPharmacists,
	AssignCourseError,
} from "@/lib/course-assign";
import { assignCoursesSchema } from "@/lib/schemas";

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

		const result = await assignCourseToPharmacists({
			courseId,
			pharmacistIds: userIds,
			dueDate,
			assignedById: session.user.id,
			actorRole: session.user.role === "ADMIN" ? "ADMIN" : "SUPERVISOR",
			sendEmails: false,
		});

		return NextResponse.json(
			{ ...result, message: "Course assigned successfully" },
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof AssignCourseError) {
			return NextResponse.json({ message: err.message }, { status: err.status });
		}
		console.error("[ASSIGNMENT_ERROR]", err);
		return serverError("Failed to assign course.");
	}
}