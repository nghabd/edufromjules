import { notFound } from "next/navigation";
import { MapPinCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { OnsiteApprovalForm } from "@/components/lesson/OnsiteApprovalForm";

type PageProps = {
	params: Promise<{ progressId: string }>;
};

export default async function OnsiteApprovalPage({ params }: PageProps) {
	const { progressId } = await params;
	const progress = await prisma.userProgress.findUnique({
		where: { id: progressId },
		include: {
			user: { select: { name: true, email: true } },
			material: {
				select: {
					type: true,
					title: true,
					topic: {
						select: {
							title: true,
							course: { select: { title: true } },
						},
					},
				},
			},
		},
	});

	if (!progress || progress.material.type !== "PRACTICAL") {
		notFound();
	}

	return (
		<div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl items-center px-4 py-10">
			<Card className="w-full border-border bg-card p-6 shadow-sm">
				<div className="mb-6 text-center">
					<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
						<MapPinCheck className="h-6 w-6" />
					</div>
					<h1 className="text-2xl font-bold">Onsite Training Approval</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Confirm the assigned pharmacist completed this onsite task.
					</p>
				</div>

				<div className="mb-6 space-y-3 rounded-md border border-border bg-muted/20 p-4">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sm text-muted-foreground">Status</span>
						<Badge variant={progress.completed ? "default" : "secondary"}>
							{progress.completed ? "Approved" : "Pending"}
						</Badge>
					</div>
					<Detail label="Pharmacist" value={progress.user.name || progress.user.email} />
					<Detail label="Course" value={progress.material.topic.course.title} />
					<Detail label="Lesson" value={progress.material.topic.title} />
					<Detail label="Onsite task" value={progress.material.title} />
				</div>

				{progress.completed ? (
					<div className="rounded-md border border-green-200 bg-green-50 p-4 text-center text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
						This approval link is no longer active because the onsite training
						has already been approved.
					</div>
				) : (
					<OnsiteApprovalForm progressId={progress.id} />
				)}
			</Card>
		</div>
	);
}

function Detail({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs font-medium uppercase text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 text-sm font-semibold">{value}</p>
		</div>
	);
}
