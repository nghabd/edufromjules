"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
	BookOpen,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Edit2,
	GraduationCap,
	MapPinCheck,
	Plus,
	Trash2,
	UserCheck,
	Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddTraineeModal } from "@/components/Dashboard/supervisor/AddTraineeModal";
import { AssignCourseModal } from "@/components/Dashboard/supervisor/AssignCourseModal";
import { BulkAssignModal } from "@/components/Dashboard/supervisor/BulkAssignModal";
import { CourseBuilderModal } from "@/components/Dashboard/shared/CourseBuilderModal";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { SupervisorAnalytics } from "@/components/analytics/SupervisorAnalytics";

const supervisorRealtimeEvents = [
	REALTIME_EVENTS.supervisorChanged,
	REALTIME_EVENTS.courseChanged,
	REALTIME_EVENTS.assignmentChanged,
	REALTIME_EVENTS.progressChanged,
	REALTIME_EVENTS.practicalApproved,
];
const supervisorRealtimeQueryKeys = [
	["supervisor-overview"],
	["unassigned-trainees"],
	["onsite-training"],
];

type AssignmentSummary = {
	id: string;
	status: string;
	progress: number;
	dueDate?: string | null;
	course: { id: string; title: string };
};

type TraineeSummary = {
	id: string;
	name?: string | null;
	email: string;
	assignments: AssignmentSummary[];
};

type CourseSummary = {
	id: string;
	title: string;
	category: string;
	_count?: { assignments: number };
	[key: string]: unknown;
};

type SupervisorOverview = {
	groupTrainees: TraineeSummary[];
	courses: CourseSummary[];
};

type OnsiteTrainingRecord = {
	id: string;
	status: string;
	completed: boolean;
	approvedAt: string | null;
	lastAccessed: string | null;
	pharmacist: { id: string; name?: string | null; email: string };
	task: {
		id: string;
		title: string;
		lesson: string;
		courseTitle: string;
	};
	approvedBy: { id: string; name?: string | null; email: string } | null;
};

type OnsiteTrainingResponse = {
	onsiteTraining: OnsiteTrainingRecord[];
};

export function SupervisorDashboard() {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
	const [searchCourses, setSearchCourses] = useState("");
	const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
	const [isAddTraineeOpen, setIsAddTraineeOpen] = useState(false);
	const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
	const [editingCourse, setEditingCourse] = useState<CourseSummary | null>(null);
	const [assigningCourse, setAssigningCourse] = useState<CourseSummary | null>(null);
	const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);

	useRealtimeQueryInvalidation({
		events: supervisorRealtimeEvents,
		queryKeys: supervisorRealtimeQueryKeys,
	});

	const { data, isLoading } = useQuery<SupervisorOverview>({
		queryKey: ["supervisor-overview"],
		queryFn: async () => (await axios.get("/api/supervisor/overview")).data,
		refetchInterval: 120_000,
	});

	const {
		data: onsiteData,
		isLoading: isOnsiteLoading,
	} = useQuery<OnsiteTrainingResponse>({
		queryKey: ["onsite-training"],
		queryFn: async () => (await axios.get("/api/supervisor/onsite-training")).data,
		refetchInterval: 120_000,
	});

	const removeTrainee = useMutation({
		mutationFn: async (id: string) =>
			axios.patch("/api/supervisor/trainees", { pharmacistId: id }),
		onSuccess: () => {
			toast.success("Pharmacist removed");
			void queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
		},
		onError: (err: unknown) => {
			toast.error(getApiErrorMessage(err, "Failed to remove pharmacist"));
		},
	});

	const deleteCourse = useMutation({
		mutationFn: async (id: string) =>
			axios.delete(`/api/supervisor/courses/${id}`),
		onSuccess: () => {
			toast.success("Course deleted");
			void queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
		},
		onError: (err: unknown) => {
			toast.error(getApiErrorMessage(err, "Failed to delete course"));
		},
	});

	const approveOnsiteTraining = useMutation({
		mutationFn: async (progressId: string) =>
			axios.patch("/api/supervisor/onsite-training", { progressId }),
		onSuccess: () => {
			toast.success("Onsite training approved");
			void queryClient.invalidateQueries({ queryKey: ["onsite-training"] });
			void queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
		},
		onError: (err: unknown) => {
			toast.error(getApiErrorMessage(err, "Failed to approve onsite training"));
		},
	});

	const trainees = useMemo(() => data?.groupTrainees ?? [], [data?.groupTrainees]);
	const courses = useMemo(() => data?.courses ?? [], [data?.courses]);
	const onsiteTraining = useMemo(
		() => onsiteData?.onsiteTraining ?? [],
		[onsiteData?.onsiteTraining],
	);
	const pendingOnsiteTraining = onsiteTraining.filter((item) => !item.completed);

	const filteredCourses = useMemo(
		() =>
			courses.filter((course) =>
				course.title.toLowerCase().includes(searchCourses.toLowerCase()),
			),
		[courses, searchCourses],
	);

	const metrics = useMemo(() => {
		const assignments = trainees.flatMap((trainee) => trainee.assignments || []);
		const completed = assignments.filter(
			(assignment) => assignment.progress === 100,
		).length;
		const atRisk = assignments.filter(
			(assignment) => assignment.progress < 100,
		).length;

		return {
			pharmacists: trainees.length,
			courses: courses.length,
			assignments: assignments.length,
			completed,
			atRisk,
			pendingOnsite: pendingOnsiteTraining.length,
		};
	}, [courses.length, pendingOnsiteTraining.length, trainees]);

	return (
		<div className="min-h-screen bg-background p-4 md:p-8">
			<div className="mx-auto max-w-7xl space-y-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium text-muted-foreground">
							Supervisor Dashboard
						</p>
						<h1 className="text-3xl font-bold text-foreground">
							Training Control
						</h1>
					</div>
					<div className="flex gap-2 flex-wrap">
						<Button type="button" onClick={() => setIsAddTraineeOpen(true)}>
							<Plus className="mr-1 h-4 w-4" />
							Add Pharmacist
						</Button>
						<Button type="button" variant="outline" onClick={() => setIsBulkAssignOpen(true)}>
							<Users className="mr-1 h-4 w-4" />
							Bulk Assign
						</Button>
						<Button
							type="button"
							onClick={() => {
								setEditingCourse(null);
								setIsAddCourseOpen(true);
							}}
						>
							<BookOpen className="mr-1 h-4 w-4" />
							Build Course
						</Button>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
					{[
						{ id: "overview", label: "Team & Courses", icon: Users },
						{ id: "analytics", label: "Analytics", icon: GraduationCap },
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
					<SupervisorAnalytics />
				) : (
					<>
						<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
							<Metric label="Pharmacists" value={metrics.pharmacists} />
							<Metric label="Courses" value={metrics.courses} />
							<Metric label="Assignments" value={metrics.assignments} />
							<Metric label="Completed" value={metrics.completed} />
							<Metric label="At Risk" value={metrics.atRisk} tone="danger" />
							<Metric
								label="Onsite Pending"
								value={metrics.pendingOnsite}
								tone={metrics.pendingOnsite > 0 ? "danger" : "default"}
							/>
						</div>

						<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
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
										<p className="p-6 text-sm text-muted-foreground">
											No pharmacists assigned.
										</p>
									)}
									{trainees.map((trainee) => (
										<PharmacistRow
											key={trainee.id}
											trainee={trainee}
											isExpanded={expandedTrainee === trainee.id}
											onToggle={() =>
												setExpandedTrainee((current) =>
													current === trainee.id ? null : trainee.id,
												)
											}
											onRemove={() => removeTrainee.mutate(trainee.id)}
										/>
									))}
								</div>
							</details>

							<details className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border p-4 [&::-webkit-details-marker]:hidden">
									<div className="flex items-center gap-2">
										<GraduationCap className="h-5 w-5 text-green-600" />
										<div>
											<h2 className="text-lg font-semibold">Courses</h2>
											<p className="text-sm text-muted-foreground">
												{filteredCourses.length} visible of {courses.length} total
											</p>
										</div>
									</div>
									<ChevronDown className="h-5 w-5 text-muted-foreground" />
								</summary>
								<div className="space-y-3 border-b border-border p-4">
									<Input
										placeholder="Search courses"
										value={searchCourses}
										onChange={(event) => setSearchCourses(event.target.value)}
									/>
								</div>
								<div className="max-h-[650px] divide-y divide-border overflow-y-auto">
									{filteredCourses.length === 0 && (
										<p className="p-6 text-sm text-muted-foreground">
											No courses found.
										</p>
									)}
									{filteredCourses.map((course) => (
										<div
											key={course.id}
											className="flex items-center justify-between gap-3 p-4"
										>
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold">
													{course.title}
												</p>
												<div className="mt-1 flex flex-wrap gap-2">
													<Badge variant="secondary">{course.category}</Badge>
													<Badge variant="outline">
														{course._count?.assignments ?? 0} assigned
													</Badge>
												</div>
											</div>
											<div className="flex shrink-0 gap-2">
												<Button
													type="button"
													size="sm"
													onClick={() => setAssigningCourse(course)}
												>
													<UserCheck className="h-4 w-4" />
												</Button>
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => {
														setEditingCourse(course);
														setIsAddCourseOpen(true);
													}}
												>
													<Edit2 className="h-4 w-4" />
												</Button>
												<Button
													type="button"
													size="sm"
													variant="destructive"
													onClick={() => deleteCourse.mutate(course.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</details>
						</div>

						<details className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border p-4 [&::-webkit-details-marker]:hidden">
								<div className="flex items-center gap-2">
									<MapPinCheck className="h-5 w-5 text-emerald-600" />
									<div>
										<h2 className="text-lg font-semibold">Onsite Training</h2>
										<p className="text-sm text-muted-foreground">
											Approve practical training completed with a trainer pharmacist.
										</p>
									</div>
								</div>
								<Badge variant={pendingOnsiteTraining.length ? "destructive" : "secondary"}>
									{pendingOnsiteTraining.length} pending
								</Badge>
							</summary>
							<div className="divide-y divide-border">
								{isOnsiteLoading && (
									<p className="p-6 text-sm text-muted-foreground">Loading...</p>
								)}
								{!isOnsiteLoading && onsiteTraining.length === 0 && (
									<p className="p-6 text-sm text-muted-foreground">
										No onsite training tasks assigned yet.
									</p>
								)}
								{onsiteTraining.map((item) => (
									<div
										key={item.id}
										className="grid gap-3 p-4 md:grid-cols-[1fr_auto]"
									>
										<div className="min-w-0">
											<div className="mb-2 flex flex-wrap items-center gap-2">
												<p className="truncate text-sm font-semibold">
													{item.task.title}
												</p>
												<Badge variant={item.completed ? "default" : "secondary"}>
													{item.completed ? "Approved" : item.status}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground">
												{item.pharmacist.name || item.pharmacist.email}
											</p>
											<p className="text-xs text-muted-foreground">
												{item.task.courseTitle} / {item.task.lesson}
											</p>
											{item.approvedBy && (
												<p className="mt-1 text-xs text-muted-foreground">
													Approved by {item.approvedBy.name || item.approvedBy.email}
												</p>
											)}
											{item.approvedAt && (
												<p className="mt-1 text-xs text-muted-foreground">
													Approved {new Date(item.approvedAt).toLocaleString()}
												</p>
											)}
										</div>
										{item.completed ? (
											<div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
												<CheckCircle2 className="h-4 w-4" />
												Complete
											</div>
										) : (
											<Button
												type="button"
												size="sm"
												onClick={() => approveOnsiteTraining.mutate(item.id)}
												disabled={approveOnsiteTraining.isPending}
											>
												<UserCheck className="mr-1 h-4 w-4" />
												Approve
											</Button>
										)}
									</div>
								))}
							</div>
						</details>
					</>
				)}

			<AddTraineeModal
				isOpen={isAddTraineeOpen}
				onClose={() => setIsAddTraineeOpen(false)}
			/>

			<BulkAssignModal
				isOpen={isBulkAssignOpen}
				onClose={() => setIsBulkAssignOpen(false)}
				pharmacists={trainees}
				courses={courses}
			/>

			{assigningCourse && (
				<AssignCourseModal
					course={assigningCourse}
					trainees={trainees}
					onClose={() => setAssigningCourse(null)}
				/>
			)}

			<CourseBuilderModal
				isOpen={isAddCourseOpen}
				editingCourse={editingCourse}
				onClose={() => {
					setIsAddCourseOpen(false);
					setEditingCourse(null);
				}}
			/>
			</div>
		</div>
	);
}

function PharmacistRow({
	trainee,
	isExpanded,
	onToggle,
	onRemove,
}: {
	trainee: TraineeSummary;
	isExpanded: boolean;
	onToggle: () => void;
	onRemove: () => void;
}) {
	return (
		<div className="p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">
						{trainee.name || "Unnamed Pharmacist"}
					</p>
					<p className="truncate text-xs text-muted-foreground">
						{trainee.email}
					</p>
				</div>
				<div className="flex gap-2">
					<Button type="button" size="sm" variant="outline" onClick={onToggle}>
						{isExpanded ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="text-destructive"
						onClick={onRemove}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{isExpanded && (
				<div className="mt-4 space-y-3 rounded-md border border-border bg-muted/20 p-3">
					{trainee.assignments?.length === 0 && (
						<p className="text-sm text-muted-foreground">
							No courses assigned.
						</p>
					)}
					{trainee.assignments?.map((assignment) => (
						<div
							key={assignment.id}
							className="rounded-md border border-border bg-background p-3"
						>
							<div className="mb-2 flex items-center justify-between gap-3">
								<p className="truncate text-sm font-medium">
									{assignment.course.title}
								</p>
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
							<p className="mt-1 text-xs text-muted-foreground">
								{assignment.progress || 0}% complete
							</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function Metric({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: number;
	tone?: "default" | "danger";
}) {
	return (
		<Card className="border-border bg-card p-4">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<p
				className={
					tone === "danger"
						? "mt-1 text-2xl font-bold text-destructive"
						: "mt-1 text-2xl font-bold"
				}
			>
				{value}
			</p>
		</Card>
	);
}

function getApiErrorMessage(error: unknown, fallback: string) {
	if (axios.isAxiosError(error)) {
		const message = error.response?.data?.message;
		return typeof message === "string" ? message : fallback;
	}
	return fallback;
}
