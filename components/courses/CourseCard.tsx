"use client";

import { ReactNode } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type CourseCardProps = {
	title: string;
	category?: string;
	description?: string;
	meta?: Array<{ label: string; value: ReactNode }>;
	progress?: number;
	accent?: string;
	expanded?: boolean;
	onToggle?: () => void;
	actions?: Array<{
		label: string;
		variant?: "default" | "outline" | "destructive" | "secondary";
		icon?: ReactNode;
		disabled?: boolean;
		onClick: () => void;
	}>;
	children?: ReactNode;
};

export function CourseCard({
	title,
	category,
	description,
	meta = [],
	progress,
	expanded,
	onToggle,
	actions = [],
	children,
}: CourseCardProps) {
	const hasBody = Boolean(children);

	return (
		<div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
			<div
				className={cn(
					"grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center",
					hasBody && "border-b border-border",
				)}
			>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<BookOpen className="h-4 w-4 shrink-0 text-primary" />
						<h3 className="truncate text-sm font-semibold text-foreground">
							{title}
						</h3>
						{category && (
							<Badge variant="secondary" className="text-xs">
								{category}
							</Badge>
						)}
					</div>
					{description && (
						<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
							{description}
						</p>
					)}
					{meta.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-2">
							{meta.map((item) => (
								<div
									key={item.label}
									className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
								>
									<span>{item.value}</span>
									<span>{item.label}</span>
								</div>
							))}
						</div>
					)}
					{typeof progress === "number" && (
						<div className="mt-3">
							<div className="mb-1 flex items-center justify-between text-xs">
								<span className="font-medium text-muted-foreground">Progress</span>
								<span className="font-bold text-foreground">{progress}%</span>
							</div>
							<Progress value={progress} className="h-2" />
						</div>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{actions.map((action) => (
						<Button
							key={action.label}
							type="button"
							size="sm"
							variant={action.variant ?? "default"}
							disabled={action.disabled}
							onClick={action.onClick}
						>
							{action.icon}
							{action.label}
						</Button>
					))}
					{hasBody && (
						<button
							type="button"
							onClick={onToggle}
							aria-label={expanded ? "Collapse course" : "Expand course"}
							className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
						>
							<ChevronDown
								className={cn(
									"h-4 w-4 transition-transform",
									expanded && "rotate-180",
								)}
							/>
						</button>
					)}
				</div>
			</div>
			{hasBody && expanded && <div className="animate-in px-4 py-3">{children}</div>}
		</div>
	);
}