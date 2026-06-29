"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { Users, X, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Pharmacist = { id: string; name?: string | null; email: string };
type Course = { id: string; title: string };

type Props = {
	isOpen: boolean;
	onClose: () => void;
	pharmacists: Pharmacist[];
	courses: Course[];
};

export function BulkAssignModal({ isOpen, onClose, pharmacists, courses }: Props) {
	const queryClient = useQueryClient();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [courseId, setCourseId] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [searchPharm, setSearchPharm] = useState("");

	const filteredPharm = pharmacists.filter(
		(p) =>
			(p.name ?? "").toLowerCase().includes(searchPharm.toLowerCase()) ||
			p.email.toLowerCase().includes(searchPharm.toLowerCase()),
	);

	const toggleAll = () => {
		if (selectedIds.size === filteredPharm.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredPharm.map((p) => p.id)));
		}
	};

	const toggle = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const assign = useMutation({
		mutationFn: async () =>
			axios.post("/api/supervisor/bulk-assign", {
				courseId,
				pharmacistIds: [...selectedIds],
				dueDate: dueDate || null,
			}),
		onSuccess: (res) => {
			toast.success(`Assigned to ${res.data.assigned} pharmacist(s)`);
			queryClient.invalidateQueries();
			onClose();
			setSelectedIds(new Set());
			setCourseId("");
			setDueDate("");
		},
		onError: () => toast.error("Bulk assign failed"),
	});

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
					<div className="flex items-center gap-2">
						<Users className="h-5 w-5 text-blue-600" />
						<h2 className="font-semibold text-slate-900 dark:text-white">
							Bulk Assign Course
						</h2>
					</div>
					<button
						onClick={onClose}
						className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
					>
						<X className="h-4 w-4 text-slate-500" />
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
					{/* Course Select */}
					<div>
						<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
							Course <span className="text-red-500">*</span>
						</label>
						<select
							value={courseId}
							onChange={(e) => setCourseId(e.target.value)}
							className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select a course...</option>
							{courses.map((c) => (
								<option key={c.id} value={c.id}>
									{c.title}
								</option>
							))}
						</select>
					</div>

					{/* Due Date */}
					<div>
						<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
							Due Date (optional)
						</label>
						<Input
							type="datetime-local"
							value={dueDate}
							onChange={(e) => setDueDate(e.target.value)}
							className="h-9 text-sm"
						/>
					</div>

					{/* Pharmacist selection */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<label className="text-sm font-medium text-slate-700 dark:text-slate-300">
								Select Team Members{" "}
								{selectedIds.size > 0 && (
									<Badge className="ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
										{selectedIds.size} selected
									</Badge>
								)}
							</label>
							<button
								className="text-xs text-blue-600 hover:underline"
								onClick={toggleAll}
							>
								{selectedIds.size === filteredPharm.length
									? "Deselect all"
									: "Select all"}
							</button>
						</div>
						<Input
							placeholder="Search pharmacists..."
							value={searchPharm}
							onChange={(e) => setSearchPharm(e.target.value)}
							className="h-8 text-sm mb-2"
						/>
						<div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden max-h-52 overflow-y-auto">
							{filteredPharm.length === 0 ? (
								<p className="py-6 text-sm text-center text-slate-400">
									No pharmacists found
								</p>
							) : (
								filteredPharm.map((p) => {
									const checked = selectedIds.has(p.id);
									return (
										<button
											key={p.id}
											className={`w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 ${
												checked ? "bg-blue-50 dark:bg-blue-950/20" : ""
											}`}
											onClick={() => toggle(p.id)}
										>
											{checked ? (
												<CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
											) : (
												<Square className="h-4 w-4 text-slate-400 flex-shrink-0" />
											)}
											<div className="min-w-0">
												<p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
													{p.name ?? p.email}
												</p>
												{p.name && (
													<p className="text-xs text-slate-500 dark:text-slate-400 truncate">
														{p.email}
													</p>
												)}
											</div>
										</button>
									);
								})
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
					<Button variant="outline" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button
						size="sm"
						onClick={() => assign.mutate()}
						disabled={!courseId || selectedIds.size === 0 || assign.isPending}
						className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
					>
						<Users className="h-4 w-4" />
						{assign.isPending
							? "Assigning..."
							: `Assign to ${selectedIds.size} pharmacist${selectedIds.size !== 1 ? "s" : ""}`}
					</Button>
				</div>
			</div>
		</div>
	);
}
