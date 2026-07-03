"use client";

import { Card } from "@/components/ui/card";

interface MetricProps {
	label: string;
	value: number;
	tone?: "default" | "danger";
}

function Metric({ label, value, tone = "default" }: MetricProps) {
	return (
		<Card className="border-border bg-card p-4">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<p className={tone === "danger" ? "mt-1 text-2xl font-bold text-destructive" : "mt-1 text-2xl font-bold"}>
				{value}
			</p>
		</Card>
	);
}

interface SupervisorStatsProps {
	metrics: {
		pharmacists: number;
		courses: number;
		assignments: number;
		completed: number;
		atRisk: number;
		pendingOnsite: number;
	};
}

export function SupervisorStats({ metrics }: SupervisorStatsProps) {
	return (
		<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
			<Metric label="Pharmacists" value={metrics.pharmacists} />
			<Metric label="Courses" value={metrics.courses} />
			<Metric label="Assignments" value={metrics.assignments} />
			<Metric label="Completed" value={metrics.completed} />
			<Metric label="At Risk" value={metrics.atRisk} tone="danger" />
			<Metric
				label="Onsite Pending"
				value={metrics.pendingOnsite}
				tone={metrics.pendingOnsite > 0 ? "danger" : "default"}
			/>
		</div>
	);
}
