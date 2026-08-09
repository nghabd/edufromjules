"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface Props {
	isOpen: boolean;
	onClose: () => void;
}

type TraineeOption = {
	id: string;
	name?: string | null;
	email: string;
};

export function AddTraineeModal({ isOpen, onClose }: Props) {
	const queryClient = useQueryClient();

	const { data: unassignedTrainees, isLoading } = useQuery({
		queryKey: ["unassigned-trainees"],
		queryFn: async () => (await axios.get("/api/supervisor/trainees")).data,
		enabled: isOpen,
	});

	const addTrainee = useMutation({
		mutationFn: async (pharmacistId: string) =>
			await axios.post("/api/supervisor/trainees", { pharmacistId }),
		onSuccess: () => {
			toast.success("Pharmacist added!");
			queryClient.invalidateQueries();
		},
	});

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-card border-border">
				<DialogHeader>
					<DialogTitle>Add Pharmacist to Group</DialogTitle>
				</DialogHeader>
				<div className="py-4 space-y-3 max-h-[400px] overflow-y-auto">
					{isLoading && (
						<div className="flex justify-center">
							<Loader2 className="animate-spin h-6 w-6 text-blue-500" />
						</div>
					)}
					{!isLoading && unassignedTrainees?.length === 0 && (
						<p className="text-sm text-center text-muted-foreground">
							No unassigned pharmacists available.
						</p>
					)}
					{unassignedTrainees?.map((t: TraineeOption) => (
						<div
							key={t.id}
							className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/30"
						>
							<div>
								<p className="font-medium text-sm">{t.name || "Unnamed"}</p>
								<p className="text-xs text-muted-foreground">{t.email}</p>
							</div>
							<Button
								size="sm"
								onClick={() => addTrainee.mutate(t.id)}
								disabled={addTrainee.isPending}
							>
								<UserPlus className="h-4 w-4 mr-1" /> Add
							</Button>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
