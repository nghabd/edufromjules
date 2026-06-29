import { NextResponse } from "next/server";
import { requireSupervisor, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireSupervisor();
		if (error) return error;

		// Get all pharmacists under this supervisor
		const pharmacists = await prisma.user.findMany({
			where: {
				role: "PHARMACIST",
				OR: [
					{ supervisorId: session.user.id },
					{ group: { supervisorId: session.user.id } },
				],
			},
			select: { id: true },
		});

		const pharmacistIds = pharmacists.map((p) => p.id);

		// Get material engagement stats
		const engagementStats = await prisma.userProgress.groupBy({
			by: ["userId"],
			where: { userId: { in: pharmacistIds } },
			_sum: { timeSpent: true },
			_avg: { progress: true },
			_count: { id: true },
		});

		const stats = {
			totalPharmacists: pharmacistIds.length,
			totalMaterialsEngaged: engagementStats.reduce(
				(sum, s) => sum + (s._count.id ?? 0),
				0,
			),
			avgTimePerPharmacist:
				engagementStats.length > 0
					? Math.round(
							engagementStats.reduce((sum, s) => sum + (s._sum.timeSpent ?? 0), 0) /
								engagementStats.length,
						)
					: 0,
			totalTimeSpent: engagementStats.reduce(
				(sum, s) => sum + (s._sum.timeSpent ?? 0),
				0,
			),
			avgProgress:
				engagementStats.length > 0
					? Math.round(
							(engagementStats.reduce((sum, s) => sum + (s._avg.progress ?? 0), 0) /
								engagementStats.length) *
								100,
						) / 100
					: 0,
		};

		return NextResponse.json(stats);
	} catch {
		return serverError("Failed to fetch engagement stats");
	}
}
