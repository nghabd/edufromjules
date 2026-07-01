import { NextResponse } from "next/server";
import { requireRole, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { courseBuilderSchema } from "@/lib/schemas";
import {
	buildTopicCreateData,
} from "@/lib/course-payload";
import { courseResponseInclude } from "@/lib/course-include";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
		if (error) return error;

		const body = await req.json().catch(() => null);
		console.log("[COURSE_CREATE] Received payload size:", JSON.stringify(body).length);
		const parsed = courseBuilderSchema.safeParse(body);
		if (!parsed.success) {
			console.error("[COURSE_CREATE] Validation failed:", JSON.stringify(parsed.error.flatten(), null, 2));
			return badRequest("Invalid course payload.", parsed.error.flatten());
		}

		const course = await prisma.course.create({
			data: {
				title: parsed.data.title,
				description: parsed.data.description,
				category: parsed.data.category,
				topics: { create: buildTopicCreateData(parsed.data.topics) },
			},
			select: {
				id: true,
				title: true,
				category: true,
				createdAt: true,
			},
		});

		await publishDashboardRefresh([
			REALTIME_EVENTS.adminChanged,
			REALTIME_EVENTS.supervisorChanged,
			REALTIME_EVENTS.courseChanged,
		]);

		return NextResponse.json(course, { status: 201 });
	} catch (err) {
		console.error("[COURSE_CREATE_ERROR]", err);
		const message = err instanceof Error ? err.message : "Failed to create course";
		return NextResponse.json({ message, details: err }, { status: 500 });
	}
}

export async function GET(req: Request) {
	const { error } = await requireRole(["SUPERVISOR", "ADMIN"]);
	if (error) return error;

	const { searchParams } = new URL(req.url);
	const page = Math.max(1, Number(searchParams.get("page") ?? 1));
	const pageSize = Math.min(
		100,
		Math.max(1, Number(searchParams.get("pageSize") ?? 25)),
	);
	const skip = (page - 1) * pageSize;

	const courses = await prisma.course.findMany({
		include: courseResponseInclude,
		orderBy: { createdAt: "desc" },
		skip,
		take: pageSize,
	});

	return NextResponse.json({ courses, page, pageSize });
}
