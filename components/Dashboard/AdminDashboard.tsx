"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { Users, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { CourseBuilderModal } from "@/components/Dashboard/shared/CourseBuilderModal";
import { UserModal } from "@/components/Dashboard/admin/UserModal";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { AdminAnalytics } from "@/components/analytics/AdminAnalytics";
import { AdminUserList } from "./admin/AdminUserList";
import { AdminCourseList } from "./admin/AdminCourseList";

const adminRealtimeEvents = [
	REALTIME_EVENTS.adminChanged,
	REALTIME_EVENTS.courseChanged,
	REALTIME_EVENTS.supervisorChanged,
];
const adminRealtimeQueryKeys = [["admin-overview"]];

type AdminUser = {
	id: string;
	name?: string | null;
	email: string;
	role: "ADMIN" | "SUPERVISOR" | "PHARMACIST";
	canApproveOnsiteTraining: boolean;
	supervisorId?: string | null;
	supervisor?: { name?: string | null; email: string } | null;
};

type AdminCourse = {
	id: string;
	title: string;
	category: string;
	_count?: { assignments: number };
	[key: string]: unknown;
};

type AdminOverview = {
	users: AdminUser[];
	courses: AdminCourse[];
};

export function AdminDashboard() {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
	const [isCourseBuilderOpen, setIsCourseBuilderOpen] = useState(false);
	const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
	const [userModalState, setUserModalState] = useState<{
		isOpen: boolean;
		user: AdminUser | null;
	}>({ isOpen: false, user: null });

	useRealtimeQueryInvalidation({
		events: adminRealtimeEvents,
		queryKeys: adminRealtimeQueryKeys,
	});

	const { data, isLoading, isError, error: queryError } = useQuery<AdminOverview>({
		queryKey: ["admin-overview"],
		queryFn: async () => (await axios.get("/api/admin/overview")).data,
		retry: 1,
	});

	const deleteUser = useMutation({
		mutationFn: async (id: string) =>
			await axios.delete(`/api/admin/users/${id}`),
		onSuccess: () => {
			toast.success("User deleted");
			queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
		},
		onError: (err) => {
			toast.error("Failed to delete user");
			console.error(err);
		}
	});

	const deleteCourse = useMutation({
		mutationFn: async (id: string) =>
			await axios.delete(`/api/admin/courses/${id}`),
		onSuccess: () => {
			toast.success("Course deleted");
			queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
		},
		onError: (err) => {
			toast.error("Failed to delete course");
			console.error(err);
		}
	});

	// Extract supervisors from the user list to pass to the modal
	const supervisorsList = useMemo(
		() => data?.users?.filter((u) => u.role === "SUPERVISOR") || [],
		[data?.users],
	);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-8">
				<div className="mx-auto max-w-7xl animate-pulse">
					<div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded mb-8" />
					<div className="h-12 w-48 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8" />
					<div className="grid gap-6 lg:grid-cols-2">
						<div className="h-96 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-border" />
						<div className="h-96 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-border" />
					</div>
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="min-h-screen bg-background p-8 flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-bold text-red-600 mb-2">Failed to load dashboard</h2>
					<p className="text-muted-foreground mb-4">
						{queryError instanceof Error ? queryError.message : "An unexpected error occurred"}
					</p>
					<Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-overview"] })}>Retry</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-8">
			<div className="mx-auto max-w-7xl">
				<h1 className="text-3xl font-bold mb-6 text-foreground">
					Admin Dashboard
				</h1>

				{/* Tabs */}
				<div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-6 w-fit">
					{[
						{ id: "overview", label: "Users & Courses", icon: Users },
						{ id: "analytics", label: "Analytics", icon: BarChart2 },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id as typeof activeTab)}
							className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
								activeTab === tab.id
									? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
							}`}
						>
							<tab.icon className="h-4 w-4" />
							{tab.label}
						</button>
					))}
				</div>

				{activeTab === "analytics" ? (
					<AdminAnalytics />
				) : (
					<div className="grid gap-6 lg:grid-cols-2">
						<AdminUserList
							users={data?.users || []}
							onAdd={() => setUserModalState({ isOpen: true, user: null })}
							onEdit={(user) => setUserModalState({ isOpen: true, user })}
							onDelete={(id) => {
								if (confirm("Are you sure you want to delete this user?")) {
									deleteUser.mutate(id);
								}
							}}
						/>
						<AdminCourseList
							courses={data?.courses || []}
							onAdd={() => {
								setEditingCourse(null);
								setIsCourseBuilderOpen(true);
							}}
							onEdit={(course) => {
								setEditingCourse(course);
								setIsCourseBuilderOpen(true);
							}}
							onDelete={(id) => {
								if (confirm("Are you sure you want to delete this course?")) {
									deleteCourse.mutate(id);
								}
							}}
						/>
					</div>
				)}

				<UserModal
					isOpen={userModalState.isOpen}
					editingUser={userModalState.user}
					supervisors={supervisorsList}
					onClose={() => setUserModalState({ isOpen: false, user: null })}
				/>
				<CourseBuilderModal
					isOpen={isCourseBuilderOpen}
					editingCourse={editingCourse}
					onClose={() => {
						setIsCourseBuilderOpen(false);
						setEditingCourse(null);
					}}
				/>
			</div>
		</div>
	);
}
