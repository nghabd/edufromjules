"use client";

import { BookOpen, Clock, Award, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
	icon: React.ReactNode;
	label: string;
	value: number;
	color: "blue" | "green" | "purple" | "orange";
	active?: boolean;
	onClick?: () => void;
}

const MetricCard = ({
	icon,
	label,
	value,
	color,
	active = false,
	onClick,
}: MetricCardProps) => {
	const colorClasses = {
		blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
		green:
			"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
		purple:
			"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
		orange:
			"bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
	};

	return (
		<Card
			className={`p-6 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow ${
				active ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""
			}`}
		>
			<div className="flex items-center gap-4">
				<div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>
				<div>
					<p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
						{label}
					</p>
					{onClick ? (
						<button
							type="button"
							onClick={onClick}
							className="text-3xl font-bold text-slate-900 underline decoration-blue-300 decoration-2 underline-offset-4 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-white dark:hover:text-blue-300 dark:focus:ring-offset-slate-900"
							aria-label={`Show ${label.toLowerCase()} courses`}
						>
							{value}
						</button>
					) : (
						<p className="text-3xl font-bold text-slate-900 dark:text-white">
							{value}
						</p>
					)}
				</div>
			</div>
		</Card>
	);
};

interface PharmacistStatsProps {
	assignedCount: number;
	inProgressCount: number;
	completedCount: number;
	overdueCount: number;
	filterStatus: string;
	onFilterChange: (status: "all" | "in-progress" | "completed" | "overdue") => void;
}

export function PharmacistStats({
	assignedCount,
	inProgressCount,
	completedCount,
	overdueCount,
	filterStatus,
	onFilterChange,
}: PharmacistStatsProps) {
	return (
		<div className="mb-8 grid gap-4 md:grid-cols-4">
			<MetricCard
				icon={<BookOpen className="h-5 w-5" />}
				label="Assigned Courses"
				value={assignedCount}
				color="blue"
				active={filterStatus === "all"}
				onClick={() => onFilterChange("all")}
			/>
			<MetricCard
				icon={<Clock className="h-5 w-5" />}
				label="In Progress"
				value={inProgressCount}
				color="purple"
				active={filterStatus === "in-progress"}
				onClick={() => onFilterChange("in-progress")}
			/>
			<MetricCard
				icon={<Award className="h-5 w-5" />}
				label="Completed"
				value={completedCount}
				color="green"
				active={filterStatus === "completed"}
				onClick={() => onFilterChange("completed")}
			/>
			<MetricCard
				icon={<CalendarDays className="h-5 w-5" />}
				label="Overdue"
				value={overdueCount}
				color="orange"
				active={filterStatus === "overdue"}
				onClick={() => onFilterChange("overdue")}
			/>
		</div>
	);
}
