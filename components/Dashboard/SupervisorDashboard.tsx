"use client";

import { useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
	ArrowRight,
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
	const { status } = useSession();
	const authenticated = status === "authenticated";
	const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
	const [searchCourses, setSearchCourses] = useState("");
	const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
	const [isAddTraineeOpen, setIsAddTraineeOpen] = useState(false);
	const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
	const [editingCourse, setEditingCourse] = useState<CourseSummary | null>(null);
	const [assigningCourse, setAssigningCourse] = useState<CourseSummary | null>(null);
	const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);
	const [traineeFilter, setTraineeFilter] = useState<
		"all" | "completed" | "at-risk"
	>("all");
	const [openSections, setOpenSections] = useState({
		tracking: true,
		courses: true,
		onsite: true,
	});

	const goToSection = (
		sectionId: string,
		sectionKey: keyof typeof openSections,
		filter?: "all" | "completed" | "at-risk",
	) => {
		if (filter) setTraineeFilter(filter);
		setOpenSections((current) => ({ ...current, [sectionKey]: true }));
		window.requestAnimationFrame(() => {
			document.getElementById(sectionId)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	};

	useRealtimeQueryInvalidation({
		events: supervisorRealtimeEvents,
		queryKeys: supervisorRealtimeQueryKeys,
		enabled: authenticated,
	});

	const { data, isLoading } = useQuery<SupervisorOverview>({
		queryKey: ["supervisor-overview"],
		queryFn: async () => (await axios.get("/api/supervisor/overview")).data,
		enabled: authenticated,
		refetchInterval: authenticated ? 120_000 : false,
	});

	const {
		data: onsiteData,
		isLoading: isOnsiteLoading,
	} = useQuery<OnsiteTrainingResponse>({
		queryKey: ["onsite-training"],
		queryFn: async () => (await axios.get("/api/supervisor/onsite-training")).data,
		enabled: authenticated,
		refetchInterval: authenticated ? 120_000 : false,
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

	const traineeCounts = useMemo(() => {
		const inProgress = trainees.filter((trainee) =>
			(trainee.assignments || []).some(
				(assignment) => assignment.progress < 100,
			),
		).length;
		const completed = trainees.filter((trainee) =>
			(trainee.assignments || []).some(
				(assignment) => assignment.progress === 100,
			),
		).length;

		return { inProgress, completed };
	}, [trainees]);

	const filteredTrainees = useMemo(() => {
		if (traineeFilter === "completed") {
			return trainees.filter((trainee) =>
				(trainee.assignments || []).some(
					(assignment) => assignment.progress === 100,
				),
			);
		}
		if (traineeFilter === "at-risk") {
			return trainees.filter((trainee) =>
				(trainee.assignments || []).some(
					(assignment) => assignment.progress < 100,
				),
			);
		}
		return trainees;
	}, [traineeFilter, trainees]);

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
							<Metric
								label="Pharmacists"
								value={metrics.pharmacists}
								loading={isLoading}
								hint="View team"
								onClick={() => goToSection("tracking", "tracking", "all")}
							/>
							<Metric
								label="Courses"
								value={metrics.courses}
								loading={isLoading}
								hint="View courses"
								onClick={() => goToSection("courses", "courses")}
							/>
							<Metric
								label="Assignments"
								value={metrics.assignments}
								loading={isLoading}
								hint="Track progress"
								onClick={() => goToSection("tracking", "tracking", "all")}
							/>
							<Metric
								label="Completed"
								value={metrics.completed}
								loading={isLoading}
								hint="Show completed"
								onClick={() =>
									goToSection("tracking", "tracking", "completed")
								}
							/>
							<Metric
								label="In Progress"
								value={traineeCounts.inProgress}
								loading={isLoading}
								hint="Show active"
								onClick={() => goToSection("tracking", "tracking", "at-risk")}
							/>
							<Metric
								label="Onsite Pending"
								value={metrics.pendingOnsite}
								loading={isLoading}
								tone={metrics.pendingOnsite > 0 ? "danger" : "default"}
								hint="Open approvals"
								onClick={() => goToSection("onsite", "onsite")}
							/>
						</div>

						<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
							<SectionCard
								id="tracking"
								icon={<Users className="h-5 w-5 text-blue-600" />}
								title="Pharmacist Tracking"
								subtitle={`${filteredTrainees.length} shown of ${trainees.length} pharmacists`}
								open={openSections.tracking}
								onToggle={() =>
									setOpenSections((current) => ({
										...current,
										tracking: !current.tracking,
									}))
								}
							>
								<div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
									<FilterChip
										active={traineeFilter === "all"}
										onClick={() => setTraineeFilter("all")}
									>
										All ({trainees.length})
									</FilterChip>
									<FilterChip
										active={traineeFilter === "completed"}
										onClick={() => setTraineeFilter("completed")}
									>
										Completed ({traineeCounts.completed})
									</FilterChip>
									<FilterChip
										active={traineeFilter === "at-risk"}
										onClick={() => setTraineeFilter("at-risk")}
									>
										In progress ({traineeCounts.inProgress})
									</FilterChip>
								</div>
								<div className="max-h-[560px] divide-y divide-border overflow-y-auto">
									{isLoading &&
										[0, 1, 2].map((index) => <RowSkeleton key={index} />)}
									{!isLoading && filteredTrainees.length === 0 && (
										<p className="p-6 text-sm text-muted-foreground">
											No pharmacists{filteredTrainees.length === 0 && trainees.length > 0
												? " match this filter"
												: " assigned"}
											.
										</p>
									)}
									{filteredTrainees.map((trainee) => (
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
							</SectionCard>

							<SectionCard
								id="courses"
								icon={<GraduationCap className="h-5 w-5 text-green-600" />}
								title="Courses"
								subtitle={`${filteredCourses.length} visible of ${courses.length} total`}
								open={openSections.courses}
								onToggle={() =>
									setOpenSections((current) => ({
										...current,
										courses: !current.courses,
									}))
								}
							>
								<div className="space-y-3 border-b border-border p-3">
									<Input
										placeholder="Search courses"
										value={searchCourses}
										onChange={(event) => setSearchCourses(event.target.value)}
									/>
								</div>
								<div className="max-h-[560px] divide-y divide-border overflow-y-auto">
									{isLoading && [0, 1].map((index) => <RowSkeleton key={index} />)}
									{!isLoading && filteredCourses.length === 0 && (
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
							</SectionCard>
						</div>

						<SectionCard
							id="onsite"
							icon={<MapPinCheck className="h-5 w-5 text-emerald-600" />}
							title="Onsite Training"
							subtitle="Approve practical training completed with a trainer pharmacist."
							open={openSections.onsite}
							onToggle={() =>
								setOpenSections((current) => ({
									...current,
									onsite: !current.onsite,
								}))
							}
							action={
								<Badge variant={pendingOnsiteTraining.length ? "destructive" : "secondary"}>
									{pendingOnsiteTraining.length} pending
								</Badge>
							}
						>
							<div className="divide-y divide-border">
								{isOnsiteLoading &&
									[0, 1, 2].map((index) => <RowSkeleton key={`onsite-${index}`} />)}
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
						</SectionCard>
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
	loading = false,
	onClick,
	hint,
	tone = "default",
}: {
	label: string;
	value: number;
	loading?: boolean;
	onClick?: () => void;
	hint?: string;
	tone?: "default" | "danger";
}) {
	return (
		<Card
			onClick={onClick}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onKeyDown={
				onClick
					? (event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onClick();
							}
						}
					: undefined
			}
			className={`border-border bg-card p-4 ${
				onClick
					? "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					: ""
			}`}
		>
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			{loading ? (
				<div className="mt-2 h-7 w-14 animate-pulse rounded-md bg-muted" />
			) : (
				<p
					className={
						tone === "danger"
							? "mt-1 text-2xl font-bold text-destructive"
							: "mt-1 text-2xl font-bold"
					}
				>
					{value}
				</p>
			)}
			{onClick && !loading && hint && (
				<p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary">
					{hint}
					<ArrowRight className="h-3 w-3" />
				</p>
			)}
		</Card>
	);
}

function SectionCard({
	id,
	icon,
	title,
	subtitle,
	open,
	onToggle,
	action,
	children,
}: {
	id?: string;
	icon: ReactNode;
	title: string;
	subtitle?: ReactNode;
	open: boolean;
	onToggle: () => void;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card className="overflow-hidden border-border bg-card shadow-sm">
			<div
				id={id}
				className="scroll-mt-24 flex items-center justify-between gap-3 border-b border-border p-4"
			>
				<div className="flex items-center gap-2">
					{icon}
					<div>
						<h2 className="text-lg font-semibold">{title}</h2>
						{subtitle && (
							<p className="text-sm text-muted-foreground">{subtitle}</p>
						)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{action}
					<Button
						type="button"
						size="sm"
						variant="ghost"
						aria-expanded={open}
						aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
						onClick={onToggle}
					>
						<ChevronDown
							className={`h-5 w-5 transition-transform ${
								open ? "rotate-0" : "-rotate-90"
							}`}
						/>
					</Button>
				</div>
			</div>
			{open && children}
		</Card>
	);
}

function FilterChip({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
				active
					? "border-primary bg-primary text-primary-foreground"
					: "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
			}`}
		>
			{children}
		</button>
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

function getApiErrorMessage(error: unknown, fallback: string) {
	if (axios.isAxiosError(error)) {
		const message = error.response?.data?.message;
		return typeof message === "string" ? message : fallback;
	}
	return fallback;
}
