"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	editingUser?: ManagedUser | null;
	supervisors: SupervisorOption[];
}

type ManagedUser = {
	id: string;
	name?: string | null;
	email: string;
	role: string;
	canApproveOnsiteTraining?: boolean;
	supervisorId?: string | null;
};

type SupervisorOption = {
	id: string;
	name?: string | null;
	email: string;
};

export function UserModal({
	isOpen,
	onClose,
	editingUser,
	supervisors,
}: Props) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState({
		name: "",
		email: "",
		password: "",
		role: "PHARMACIST",
		canApproveOnsiteTraining: false,
		supervisorId: "",
	});

	useEffect(() => {
		if (editingUser)
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setForm({
				name: editingUser.name || "",
				email: editingUser.email,
				password: "",
				role: editingUser.role,
				canApproveOnsiteTraining:
					editingUser.role === "PHARMACIST"
						? Boolean(editingUser.canApproveOnsiteTraining)
						: false,
				supervisorId: editingUser.supervisorId || "",
			});
		else
			setForm({
				name: "",
				email: "",
				password: "",
				role: "PHARMACIST",
				canApproveOnsiteTraining: false,
				supervisorId: "",
			});
	}, [editingUser, isOpen]);

	const saveUser = useMutation({
		mutationFn: async (data: typeof form) =>
			editingUser
				? await axios.patch(`/api/admin/users/${editingUser.id}`, data)
				: await axios.post("/api/admin/users", data),
		onSuccess: () => {
			toast.success(`User saved`);
			queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
			onClose();
		},
		onError: (err: unknown) =>
			toast.error(getApiErrorMessage(err, "Failed to save user")),
	});

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-card border-border">
				<DialogHeader>
					<DialogTitle>
						{editingUser ? "Edit User" : "Add New User"}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-4 text-foreground">
					<div>
						<label className="text-sm font-medium">Name</label>
						<Input
							className="bg-background"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
						/>
					</div>
					{!editingUser && (
						<>
							<div>
								<label className="text-sm font-medium">Email</label>
								<Input
									className="bg-background"
									type="email"
									value={form.email}
									onChange={(e) => setForm({ ...form, email: e.target.value })}
								/>
							</div>
							<div>
								<label className="text-sm font-medium">Password</label>
								<Input
									className="bg-background"
									type="password"
									value={form.password}
									onChange={(e) =>
										setForm({ ...form, password: e.target.value })
									}
								/>
							</div>
						</>
					)}
					<div>
						<label className="text-sm font-medium">Role</label>
						<select
							className="w-full border border-border bg-background rounded-md p-2 h-10 mt-1"
							value={form.role}
							onChange={(e) =>
								setForm({
									...form,
									role: e.target.value,
									canApproveOnsiteTraining:
										e.target.value === "PHARMACIST"
											? form.canApproveOnsiteTraining
											: false,
									supervisorId:
										e.target.value === "PHARMACIST"
											? form.supervisorId
											: "",
								})
							}
						>
							<option value="PHARMACIST">Pharmacist</option>
							<option value="SUPERVISOR">Supervisor</option>
							<option value="ADMIN">Admin</option>
						</select>
					</div>

					{/* NEW: Supervisor Assignment Dropdown */}
					{form.role === "PHARMACIST" && (
						<>
							<div>
								<label className="text-sm font-medium">
									Assign to Supervisor (Optional)
								</label>
								<select
									className="w-full border border-border bg-background rounded-md p-2 h-10 mt-1"
									value={form.supervisorId}
									onChange={(e) =>
										setForm({ ...form, supervisorId: e.target.value })
									}
								>
									<option value="">-- Unassigned --</option>
									{supervisors.map((sup) => (
										<option key={sup.id} value={sup.id}>
											{sup.name || sup.email}
										</option>
									))}
								</select>
							</div>
							<label className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm">
								<input
									type="checkbox"
									className="mt-1 h-4 w-4"
									checked={form.canApproveOnsiteTraining}
									onChange={(event) =>
										setForm({
											...form,
											canApproveOnsiteTraining: event.target.checked,
										})
									}
								/>
								<span>
									<span className="block font-medium">
										Onsite trainer pharmacist
									</span>
									<span className="block text-xs text-muted-foreground">
										Can approve onsite practical training for other pharmacists
										in the same group or supervision chain.
									</span>
								</span>
							</label>
						</>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={() => saveUser.mutate(form)}
						disabled={saveUser.isPending}
					>
						{saveUser.isPending ? "Saving..." : "Save User"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function getApiErrorMessage(error: unknown, fallback: string) {
	if (axios.isAxiosError(error)) {
		const message = error.response?.data?.message;
		return typeof message === "string" ? message : fallback;
	}
	return fallback;
}
