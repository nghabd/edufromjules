import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// We use notifications as an audit trail + add a dedicated query for key events
// For a full audit log, we query recent notifications of type ACTION across all users
export async function GET(req: Request) {
	try {
		const { error } = await requireAdmin();
		if (error) return error;

		const url = new URL(req.url);
		const page = parseInt(url.searchParams.get("page") ?? "1");
		const limit = 50;
		const skip = (page - 1) * limit;

		// Recent assignments (enrollments)
		const [assignments, userCreations, certificates, total] = await Promise.all([
			prisma.courseAssignment.findMany({
				orderBy: { createdAt: "desc" },
				take: limit,
				skip,
				include: {
					pharmacist: { select: { name: true, email: true } },
					assignedBy: { select: { name: true, email: true } },
					course: { select: { title: true } },
				},
			}),
			prisma.user.findMany({
				orderBy: { createdAt: "desc" },
				take: 20,
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					createdAt: true,
				},
			}),
			prisma.certificate.findMany({
				orderBy: { issueDate: "desc" },
				take: 20,
				include: {
					user: { select: { name: true, email: true } },
				},
			}),
			prisma.courseAssignment.count(),
		]);

		// Merge and sort as unified audit events
		const events = [
			...assignments.map((a) => ({
				id: `assign-${a.id}`,
				type: "ASSIGNMENT" as const,
				action: `${a.assignedBy.name ?? a.assignedBy.email} assigned "${a.course.title}" to ${a.pharmacist.name ?? a.pharmacist.email}`,
				actor: a.assignedBy.name ?? a.assignedBy.email,
				target: a.pharmacist.name ?? a.pharmacist.email,
				detail: a.course.title,
				timestamp: a.createdAt,
			})),
			...userCreations.map((u) => ({
				id: `user-${u.id}`,
				type: "USER_CREATED" as const,
				action: `User "${u.name ?? u.email}" created with role ${u.role}`,
				actor: "System",
				target: u.name ?? u.email,
				detail: u.role,
				timestamp: u.createdAt,
			})),
			...certificates.map((c) => ({
				id: `cert-${c.id}`,
				type: "CERTIFICATE" as const,
				action: `Certificate issued to ${c.user.name ?? c.user.email} for "${c.courseName}"`,
				actor: "System",
				target: c.user.name ?? c.user.email,
				detail: c.courseName,
				timestamp: c.issueDate,
			})),
		].sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);

		return NextResponse.json({ events, total, page, pages: Math.ceil(total / limit) });
	} catch {
		return serverError("Failed to fetch audit log");
	}
}
