import { NextResponse } from "next/server";
import { requireSupervisor, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireSupervisor();
		if (error) return error;

		const pharmacists = await prisma.user.findMany({
			where: {
				role: "PHARMACIST",
				OR: [
					{ supervisorId: session.user.id },
					{ group: { supervisorId: session.user.id } },
				],
			},
			select: {
				name: true,
				email: true,
				createdAt: true,
				courseAssignments: {
					select: {
						status: true,
						dueDate: true,
						createdAt: true,
						course: { select: { title: true } },
					},
				},
				quizAttempts: { select: { score: true, passed: true } },
				certificates: { select: { courseName: true, issueDate: true } },
			},
		});

		const now = new Date();
		const rows: string[] = [
			"Name,Email,Course,Status,Due Date,Overdue,Avg Quiz Score,Certificates,Joined",
		];

		for (const p of pharmacists) {
			const avgScore =
				p.quizAttempts.length > 0
					? (
							p.quizAttempts.reduce((s, a) => s + a.score, 0) /
							p.quizAttempts.length
						).toFixed(1)
					: "N/A";
			const certs = p.certificates.length;
			const joined = p.createdAt.toISOString().slice(0, 10);

			if (p.courseAssignments.length === 0) {
				rows.push(
					`"${p.name ?? ""}","${p.email}","(no courses)","","","","${avgScore}","${certs}","${joined}"`,
				);
			} else {
				for (const a of p.courseAssignments) {
					const dueDate = a.dueDate
						? a.dueDate.toISOString().slice(0, 10)
						: "";
					const overdue =
						a.dueDate && new Date(a.dueDate) < now && a.status !== "COMPLETED"
							? "YES"
							: "NO";
					rows.push(
						`"${p.name ?? ""}","${p.email}","${a.course.title}","${a.status}","${dueDate}","${overdue}","${avgScore}","${certs}","${joined}"`,
					);
				}
			}
		}

		const csv = rows.join("\n");
		return new NextResponse(csv, {
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="team-progress-${new Date().toISOString().slice(0, 10)}.csv"`,
			},
		});
	} catch {
		return serverError("Failed to export data");
	}
}
