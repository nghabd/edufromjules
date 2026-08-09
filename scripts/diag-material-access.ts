import { prisma } from "../lib/prisma";
import { findAccessibleMaterial } from "../lib/material-access";

async function main() {
	const pharmacists = await prisma.user.findMany({
		where: { role: "PHARMACIST" },
		select: { id: true, name: true, email: true },
	});

	for (const pharm of pharmacists) {
		const dashboardAssignments = await prisma.courseAssignment.findMany({
			where: { pharmacistId: pharm.id },
			include: {
				course: {
					include: {
						topics: { include: { materials: { select: { id: true, title: true, type: true } } } },
					},
				},
			},
		});

		const dashboardMaterialIds = new Set(
			dashboardAssignments.flatMap((a) =>
				a.course.topics.flatMap((t) => t.materials.map((m) => m.id)),
			),
		);

		for (const materialId of dashboardMaterialIds) {
			// exact same call as the route
			const found = await findAccessibleMaterial(materialId, pharm.id, "PHARMACIST");
			if (!found) {
				console.log(`FAIL dashboard material ${materialId} for PHARMACIST ${pharm.id} (${pharm.email})`);
			}
		}
	}
	console.log("DONE");
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());