"use client";

import { Users, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type AssignmentSummary = {
	id: string;
	status: string;
	progress: number;
	course: { id: string; title: string };
};

type TraineeSummary = {
	id: string;
	name?: string | null;
	email: string;
	assignments: AssignmentSummary[];
};

interface SupervisorTraineeListProps {
	trainees: TraineeSummary[];
	onRemove: (id: string) => void;
	isLoading?: boolean;
}

export function SupervisorTraineeList({ trainees, onRemove, isLoading }: SupervisorTraineeListProps) {
	const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);

	return (
		<details className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border p-4 [&::-webkit-details-marker]:hidden">
				<div className="flex items-center gap-2">
					<Users className="h-5 w-5 text-blue-600" />
					<div>
						<h2 className="text-lg font-semibold">Pharmacist Tracking</h2>
						<p className="text-sm text-muted-foreground">
							{trainees.length} pharmacists in view
						</p>
					</div>
				</div>
				<ChevronDown className="h-5 w-5 text-muted-foreground" />
			</summary>
			<div className="max-h-[650px] divide-y divide-border overflow-y-auto">
				{isLoading && (
					<p className="p-6 text-sm text-muted-foreground">Loading...</p>
				)}
				{!isLoading && trainees.length === 0 && (
					<p className="p-6 text-sm text-muted-foreground">No pharmacists assigned.</p>
				)}
				{trainees.map((trainee) => (
					<div key={trainee.id} className="p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold">{trainee.name || "Unnamed Pharmacist"}</p>
								<p className="truncate text-xs text-muted-foreground">{trainee.email}</p>
							</div>
							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setExpandedTrainee(expandedTrainee === trainee.id ? null : trainee.id)}
								>
									{expandedTrainee === trainee.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="text-destructive"
									onClick={() => onRemove(trainee.id)}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{expandedTrainee === trainee.id && (
							<div className="mt-4 space-y-3 rounded-md border border-border bg-muted/20 p-3">
								{trainee.assignments?.length === 0 ? (
									<p className="text-xs text-muted-foreground text-center">No courses assigned.</p>
								) : (
									trainee.assignments?.map((assignment) => (
										<div key={assignment.id} className="rounded-md border border-border bg-background p-3">
											<div className="mb-2 flex items-center justify-between gap-3">
												<p className="truncate text-sm font-medium">{assignment.course.title}</p>
												<Badge variant={assignment.progress === 100 ? "default" : "secondary"}>
													{assignment.status}
												</Badge>
											</div>
											<div className="h-2 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full bg-primary transition-all"
													style={{ width: `${assignment.progress || 0}%` }}
												/>
											</div>
											<p className="mt-1 text-[10px] text-muted-foreground">
												{assignment.progress || 0}% complete
											</p>
										</div>
									))
								)}
							</div>
						)}
					</div>
				))}
			</div>
		</details>
	);
}
