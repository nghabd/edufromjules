"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Trash2, Edit2, Users, BookOpen, Plus, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { UserModal } from "@/components/Dashboard/admin/UserModal";
import { CourseCard } from "@/components/courses/CourseCard";
import { CourseTopicList } from "@/components/courses/CourseTopicList";
import {
	CourseDetailDialog,
	type CourseDetailData,
} from "@/components/courses/CourseDetailDialog";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { AdminAnalytics } from "@/components/analytics/AdminAnalytics";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";

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
	const { status } = useSession();
	const authenticated = status === "authenticated";
	const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
	const [searchUsers, setSearchUsers] = useState("");
	const [searchCourses, setSearchCourses] = useState("");
	const [viewingCourse, setViewingCourse] = useState<CourseDetailData | null>(null);
	const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
	const [userModalState, setUserModalState] = useState<{
		isOpen: boolean;
		user: AdminUser | null;
	}>({ isOpen: false, user: null });

	useRealtimeQueryInvalidation({
		events: adminRealtimeEvents,
		queryKeys: adminRealtimeQueryKeys,
		enabled: authenticated,
	});

	const { data, isLoading } = useQuery<AdminOverview>({
		queryKey: ["admin-overview"],
		queryFn: async () => (await axios.get("/api/admin/overview")).data,
		enabled: authenticated,
	});
	const deleteUser = useMutation({
		mutationFn: async (id: string) =>
			await axios.delete(`/api/admin/users/${id}`),
		onSuccess: () => {
			toast.success("Deleted");
			queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
		},
	});
	const deleteCourse = useMutation({
		mutationFn: async (id: string) =>
			await axios.delete(`/api/admin/courses/${id}`),
		onSuccess: () => {
			toast.success("Deleted");
			queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
		},
	});

// Derive data before early return to satisfy hooks rules
	const filteredUsers = useMemo(
		() =>
			data?.users?.filter(
				(u) =>
					u.name?.toLowerCase().includes(searchUsers.toLowerCase()) ||
					u.email?.toLowerCase().includes(searchUsers.toLowerCase()),
			) ?? [],
		[data?.users, searchUsers],
	);
	const filteredCourses = useMemo(
		() =>
			data?.courses?.filter(
				(c) =>
					c.title.toLowerCase().includes(searchCourses.toLowerCase()) ||
					c.category?.toLowerCase().includes(searchCourses.toLowerCase()),
			) ?? [],
		[data?.courses, searchCourses],
	);
	const supervisorsList = useMemo(
		() => data?.users?.filter((u) => u.role === "SUPERVISOR") || [],
		[data],
	);

	if (isLoading) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<div className="space-y-6">
					<div className="space-y-2">
						<Skeleton className="h-8 w-64 rounded" />
						<Skeleton className="h-4 w-80 rounded" />
					</div>
					<div className="grid gap-4 md:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<SkeletonCard key={i} />
						))}
					</div>
					<div className="grid gap-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="h-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
						))}
					</div>
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
						<details className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-6 py-4 [&::-webkit-details-marker]:hidden">
								<div>
									<h2 className="flex gap-2 text-lg font-bold">
										<Users className="h-5 w-5 text-blue-600" /> Users
									</h2>
									<p className="text-sm text-muted-foreground">
										{isLoading ? "Loading..." : `${filteredUsers.length} accounts`}
									</p>
								</div>
								<Button
									type="button"
									size="sm"
									onClick={() => setUserModalState({ isOpen: true, user: null })}
								>
									<Plus className="h-4 w-4" /> Add User
								</Button>
							</summary>
							<div className="p-6">
								<Input
									placeholder="Search..."
									value={searchUsers}
									onChange={(e) => setSearchUsers(e.target.value)}
								/>
								<div className="mt-4 max-h-[500px] overflow-y-auto divide-y divide-border rounded-xl border border-border">
									{isLoading &&
										[0, 1, 2, 3].map((index) => (
											<RowSkeleton key={`user-${index}`} />
										))}
									{!isLoading && filteredUsers.length === 0 && (
										<p className="p-6 text-sm text-muted-foreground">
											No users found.
										</p>
									)}
									{filteredUsers.map((user) => (
										<div
											key={user.id}
											className="flex items-center justify-between gap-3 p-4"
										>
											<div className="flex min-w-0 flex-col gap-1">
												<p className="truncate text-sm font-medium">
													{user.name ?? user.email}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{user.email}
												</p>
												{user.role === "PHARMACIST" && user.supervisor && (
													<p className="w-fit rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
														Supervisor:{" "}
														{user.supervisor.name || user.supervisor.email}
													</p>
												)}
												{user.role === "PHARMACIST" &&
													user.canApproveOnsiteTraining && (
														<p className="w-fit rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
															Onsite trainer
														</p>
													)}
											</div>
											<div className="flex shrink-0 gap-2">
												<Badge variant="secondary" className="text-xs">
													{user.role}
												</Badge>
												<Button
													variant="outline"
													size="icon"
													onClick={() =>
														setUserModalState({ isOpen: true, user })
													}
												>
													<Edit2 className="h-3 w-3" />
												</Button>
												<Button
													variant="destructive"
													size="icon"
													onClick={() => deleteUser.mutate(user.id)}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						</details>

						<details className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-6 py-4 [&::-webkit-details-marker]:hidden">
								<div>
									<h2 className="flex gap-2 text-lg font-bold">
										<BookOpen className="h-5 w-5 text-green-600" /> Courses
									</h2>
									<p className="text-sm text-muted-foreground">
										{isLoading ? "Loading..." : `${filteredCourses.length} courses`}
									</p>
								</div>
							</summary>
							<div className="p-6">
								<Input
									placeholder="Search..."
									value={searchCourses}
									onChange={(e) => setSearchCourses(e.target.value)}
								/>
								<div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto">
									{isLoading &&
										[0, 1, 2].map((index) => (
											<RowSkeleton key={`course-${index}`} />
										))}
									{!isLoading && filteredCourses.length === 0 && (
										<p className="p-6 text-sm text-muted-foreground">
											No courses found.
										</p>
									)}
									{filteredCourses.map((course) => (
										<CourseCard
											key={course.id}
											title={course.title}
											category={course.category}
											meta={[
												{
													label: "assigned",
													value: course._count?.assignments ?? 0,
												},
											]}
											expanded={expandedCourses.has(course.id)}
											onToggle={() =>
												setExpandedCourses((current) => {
													const next = new Set(current);
													if (next.has(course.id)) next.delete(course.id);
													else next.add(course.id);
													return next;
												})
											}
											actions={[
												{
													label: "Details",
													variant: "outline",
													icon: <BookOpen className="mr-1 h-4 w-4" />,
													onClick: () => setViewingCourse(course as CourseDetailData),
												},
												{
													label: "Delete",
													variant: "destructive",
													icon: <Trash2 className="mr-1 h-4 w-4" />,
													disabled: deleteCourse.isPending,
													onClick: () => deleteCourse.mutate(course.id),
												},
											]}
										>
											<CourseTopicList
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												topics={(course.topics ?? []) as any}
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												quizzes={(course.quizzes ?? []) as any}
											/>
										</CourseCard>
									))}
								</div>
							</div>
						</details>
					</div>
				)}

			<UserModal
				isOpen={userModalState.isOpen}
				editingUser={userModalState.user}
				supervisors={supervisorsList}
				onClose={() => setUserModalState({ isOpen: false, user: null })}
			/>
			<CourseDetailDialog
				open={Boolean(viewingCourse)}
				onOpenChange={(open) => !open && setViewingCourse(null)}
				course={viewingCourse}
			/>
			</div>
		</div>
	);
}

function RowSkeleton() {
	return (
		<div className="flex items-center gap-3 p-4">
			<div className="flex-1 space-y-2">
				<div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
				<div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
			</div>
			<div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
		</div>
	);
}
