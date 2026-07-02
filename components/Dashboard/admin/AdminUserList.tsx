"use client";

import { Users, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

type AdminUser = {
	id: string;
	name?: string | null;
	email: string;
	role: "ADMIN" | "SUPERVISOR" | "PHARMACIST";
	canApproveOnsiteTraining: boolean;
	supervisorId?: string | null;
	supervisor?: { name?: string | null; email: string } | null;
};

interface AdminUserListProps {
	users: AdminUser[];
	onEdit: (user: AdminUser) => void;
	onDelete: (id: string) => void;
	onAdd: () => void;
}

export function AdminUserList({ users, onEdit, onDelete, onAdd }: AdminUserListProps) {
	const [search, setSearch] = useState("");

	const filteredUsers = useMemo(
		() =>
			users.filter(
				(u) =>
					u.name?.toLowerCase().includes(search.toLowerCase()) ||
					u.email.toLowerCase().includes(search.toLowerCase()),
			),
		[users, search],
	);

	return (
		<details open className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-6 py-4 [&::-webkit-details-marker]:hidden">
				<div>
					<h2 className="flex gap-2 text-lg font-bold">
						<Users className="h-5 w-5 text-blue-600" /> Users
					</h2>
					<p className="text-sm text-muted-foreground">
						{filteredUsers.length} accounts
					</p>
				</div>
				<Button type="button" size="sm" onClick={onAdd}>
					<Plus className="h-4 w-4" /> Add User
				</Button>
			</summary>
			<div className="p-6">
				<Input
					placeholder="Search users..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<div className="mt-4 max-h-[500px] overflow-y-auto divide-y divide-border rounded-xl border border-border">
					{filteredUsers.length === 0 ? (
						<p className="p-8 text-center text-sm text-muted-foreground">No users found.</p>
					) : (
						filteredUsers.map((user) => (
							<div key={user.id} className="flex items-center justify-between gap-3 p-4">
								<div className="flex min-w-0 flex-col gap-1">
									<p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
									<p className="truncate text-xs text-muted-foreground">{user.email}</p>
									{user.role === "PHARMACIST" && user.supervisor && (
										<p className="w-fit rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
											Supervisor: {user.supervisor.name || user.supervisor.email}
										</p>
									)}
									{user.role === "PHARMACIST" && user.canApproveOnsiteTraining && (
										<p className="w-fit rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
											Onsite trainer
										</p>
									)}
								</div>
								<div className="flex shrink-0 gap-2">
									<Badge variant="secondary" className="text-xs">
										{user.role}
									</Badge>
									<Button variant="outline" size="icon" onClick={() => onEdit(user)}>
										<Edit2 className="h-3 w-3" />
									</Button>
									<Button variant="destructive" size="icon" onClick={() => onDelete(user.id)}>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</details>
	);
}
