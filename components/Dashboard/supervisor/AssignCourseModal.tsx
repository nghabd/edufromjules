"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type Trainee = {
	id: string;
	name?: string | null;
	email: string;
	assignments?: Array<{ course: { id: string; title: string } }>;
};

type Course = {
	id: string;
	title: string;
};

export function AssignCourseModal({
	course,
	trainees,
	onClose,
}: {
	course: Course;
	trainees: Trainee[];
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
	const [dueDate, setDueDate] = useState("");

	const alreadyAssigned = useMemo(
		() =>
			new Set(
				trainees
					.filter((trainee) =>
						trainee.assignments?.some(
							(assignment) => assignment.course.id === course.id,
						),
					)
					.map((trainee) => trainee.id),
			),
		[course.id, trainees],
	);

	const assignCourse = useMutation({
		mutationFn: async () =>
			axios.post(`/api/supervisor/courses/${course.id}/assign`, {
				userIds: selectedTrainees,
				dueDate: new Date(dueDate).toISOString(),
			}),
		onSuccess: () => {
			toast.success("Course assigned");
			void queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
			setSelectedTrainees([]);
			setDueDate("");
			onClose();
		},
		onError: (err: unknown) => {
			if (axios.isAxiosError(err)) {
				const message = err.response?.data?.message;
				toast.error(typeof message === "string" ? message : "Failed to assign course");
				return;
			}
			toast.error("Failed to assign course");
		},
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="border-border bg-card">
				<DialogHeader>
					<DialogTitle>Assign: {course.title}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div>
						<label className="mb-1.5 block text-sm font-medium">
							Deadline for completion <span className="text-destructive">*</span>
						</label>
						<input
							type="datetime-local"
							value={dueDate}
							min={new Date().toISOString().slice(0, 16)}
							onChange={(event) => setDueDate(event.target.value)}
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							The course must be finished by this date and time.
						</p>
					</div>
					<div className="max-h-[300px] space-y-2 overflow-y-auto">
					{trainees.length === 0 && (
						<p className="text-sm text-muted-foreground">
							No pharmacists available.
						</p>
					)}
					{trainees.map((trainee) => {
						const disabled = alreadyAssigned.has(trainee.id);
						return (
							<label
								key={trainee.id}
								className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/30"
							>
								<input
									type="checkbox"
									className="h-4 w-4"
									disabled={disabled}
									checked={selectedTrainees.includes(trainee.id)}
									onChange={() =>
										setSelectedTrainees((current) =>
											current.includes(trainee.id)
												? current.filter((id) => id !== trainee.id)
												: [...current, trainee.id],
										)
									}
								/>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium">
										{trainee.name || trainee.email}
									</span>
									<span className="block truncate text-xs text-muted-foreground">
										{disabled ? "Already assigned" : trainee.email}
									</span>
								</span>
							</label>
						);
					})}
					</div>
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={
							selectedTrainees.length === 0 ||
							!dueDate ||
							assignCourse.isPending
						}
						onClick={() => assignCourse.mutate()}
					>
						<UserCheck className="mr-1 h-4 w-4" />
						Assign {selectedTrainees.length}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
