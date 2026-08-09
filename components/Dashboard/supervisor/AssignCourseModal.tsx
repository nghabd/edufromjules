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
			axios.post("/api/supervisor/assignments", {
				courseId: course.id,
				userIds: selectedTrainees,
			}),
		onSuccess: () => {
			toast.success("Course assigned");
			void queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
			setSelectedTrainees([]);
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
				<div className="max-h-[360px] space-y-2 overflow-y-auto py-2">
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
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={selectedTrainees.length === 0 || assignCourse.isPending}
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
