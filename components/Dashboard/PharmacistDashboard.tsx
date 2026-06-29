"use client";

import React, { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
	Award,
	BookOpen,
	CalendarDays,
	FileText,
	History,
	ChevronDown,
	MapPinCheck,
	PlayCircle,
	AlertCircle,
	Clock,
	UserRound,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialViewer } from "@/components/lesson/MaterialViewer";
import { InlineQuiz } from "@/components/lesson/InlineQuiz";
import { SignOffModal } from "@/components/lesson/SignOffModal";
import { CertificatesPanel } from "@/components/certificates/CertificatesPanel";
import { QuizHistoryPanel } from "@/components/quiz/QuizHistoryPanel";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

const pharmacistRealtimeEvents = [
	REALTIME_EVENTS.pharmacistChanged,
	REALTIME_EVENTS.assignmentChanged,
	REALTIME_EVENTS.progressChanged,
	REALTIME_EVENTS.practicalApproved,
	REALTIME_EVENTS.notificationCreated,
];
const pharmacistRealtimeQueryKeys = [
	["pharmacist-dashboard"],
	["certificates"],
	["quiz-history"],
	["account-profile"],
];

type Material = {
	progressId: string | null;
	id: string;
	title: string;
	type: "PDF" | "VIDEO" | string;
	url: string;
	gateQuestion?: string | null;
	opened: boolean;
	completed: boolean;
	completionStatus?: string;
	progress: number;
};

type Topic = {
	id: string;
	title: string;
	description: string;
	materials: Material[];
	quizAvailable: boolean;
	quiz: Quiz | null;
};

type Quiz = {
	id: string;
	title: string;
	passingScore: number;
	timeLimit: number;
	bestScore: number;
	questions: Array<{
		id: string;
		question: string;
		type?: "RADIO" | "SELECT" | "MULTI_SELECT" | "TRUE_FALSE" | "COMPLETE";
		options: string[];
	}>;
};

type AssignedCourse = {
	assignmentId: string;
	courseId: string;
	courseName: string;
	description: string;
	category: string;
	dueDate: string | null;
	progress: number;
	completed: boolean;
	completedTopics: number;
	totalTopics: number;
	completedParts: number;
	totalParts: number;
	topics: Topic[];
	courseQuizAvailable: boolean;
	courseQuiz: Quiz | null;
};

type DashboardData = {
	assignedCourses: AssignedCourse[];
	coursesInProgress: AssignedCourse[];
	completedCourses: AssignedCourse[];
	upcomingDeadlines: AssignedCourse[];
	overdueCourses: AssignedCourse[];
	totalHoursLearned: number;
	certificatesEarned: number;
};

type CourseFilter = "all" | "in-progress" | "completed" | "overdue";

export const PharmacistDashboard: React.FC = () => {
	const queryClient = useQueryClient();
	const coursesSectionRef = useRef<HTMLDivElement | null>(null);
	const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(
		null,
	);
	const [selectedPractical, setSelectedPractical] = useState<Material | null>(
		null,
	);
	const [filterStatus, setFilterStatus] = useState<CourseFilter>("all");
	const [activeTab, setActiveTab] = useState("courses");

	const refreshDashboard = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: ["pharmacist-dashboard"] });
	}, [queryClient]);

	const openMaterial = (material: Material) => {
		if (material.type === "PRACTICAL") {
			if (material.completed) {
				toast.success("Onsite training already approved.");
				return;
			}
			if (!material.progressId) {
				toast.error("Onsite task is still preparing. Please refresh and try again.");
				refreshDashboard();
				return;
			}
			setSelectedPractical(material);
			return;
		}

		setSelectedMaterial(material);
	};

	useRealtimeQueryInvalidation({
		events: pharmacistRealtimeEvents,
		queryKeys: pharmacistRealtimeQueryKeys,
	});

	const { data, isLoading, error } = useQuery<DashboardData>({
		queryKey: ["pharmacist-dashboard"],
		queryFn: async () => {
			const response = await axios.get<DashboardData>(
				"/api/pharmacist/dashboard",
			);
			return response.data;
		},
		refetchInterval: 120_000,
	});

	if (isLoading) return <DashboardSkeleton />;

	if (error) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
					<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
					<div>
						<p className="text-sm font-medium text-red-900 dark:text-red-200">
							Failed to load your dashboard. Please refresh the page.
						</p>
					</div>
				</div>
			</div>
		);
	}

	const assignedCourses = data?.assignedCourses ?? [];
	const isCourseCompleted = (course: AssignedCourse) =>
		course.completed ?? course.progress >= 100;
	const unfinishedCourses =
		data?.coursesInProgress ??
		assignedCourses.filter((course) => !isCourseCompleted(course));
	const completedCourses =
		data?.completedCourses ??
		assignedCourses.filter((course) => isCourseCompleted(course));
	const overdueCourses =
		data?.overdueCourses ??
		assignedCourses.filter(
			(course) =>
				course.dueDate &&
				!isCourseCompleted(course) &&
				isPast(new Date(course.dueDate)),
		);
	const overdueAssignmentIds = new Set(
		overdueCourses.map((course) => course.assignmentId),
	);

	const selectCourseFilter = (status: CourseFilter) => {
		setActiveTab("courses");
		setFilterStatus(status);
		window.requestAnimationFrame(() => {
			coursesSectionRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	};

	// Filter courses
	const filteredCourses = assignedCourses.filter((course) => {
		if (filterStatus === "in-progress") {
			return !isCourseCompleted(course);
		}
		if (filterStatus === "completed") {
			return isCourseCompleted(course);
		}
		if (filterStatus === "overdue") {
			return overdueAssignmentIds.has(course.assignmentId);
		}
		return true;
	});

	const getMaterialStatusLabel = (material: Material) => {
		if (material.completed) return "Done";
		if (material.type === "PRACTICAL") {
			return material.progressId ? "Start onsite" : "Preparing";
		}
		return material.opened ? "Opened" : material.type;
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
				{/* Header */}
				<div className="mb-8">
					<p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
						Pharmacist Workspace
					</p>
					<h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
						My Learning Journey
					</h1>
					<p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
						Track your progress, complete assignments, and earn certificates
					</p>
				</div>

				{/* Stats Grid */}
				<div className="mb-8 grid gap-4 md:grid-cols-4">
					<MetricCard
						icon={<BookOpen className="h-5 w-5" />}
						label="Assigned Courses"
						value={assignedCourses.length}
						color="blue"
						active={filterStatus === "all"}
						onClick={() => selectCourseFilter("all")}
					/>
					<MetricCard
						icon={<Clock className="h-5 w-5" />}
						label="In Progress"
						value={unfinishedCourses.length}
						color="purple"
						active={filterStatus === "in-progress"}
						onClick={() => selectCourseFilter("in-progress")}
					/>
					<MetricCard
						icon={<Award className="h-5 w-5" />}
						label="Completed"
						value={completedCourses.length}
						color="green"
						active={filterStatus === "completed"}
						onClick={() => selectCourseFilter("completed")}
					/>
					<MetricCard
						icon={<CalendarDays className="h-5 w-5" />}
						label="Overdue"
						value={overdueCourses.length}
						color="orange"
						active={filterStatus === "overdue"}
						onClick={() => selectCourseFilter("overdue")}
					/>
				</div>

				{/* Urgent Alerts */}
				{overdueCourses.length > 0 && (
					<div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
						<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
								You have {overdueCourses.length} overdue course
								{overdueCourses.length > 1 ? "s" : ""}.
							</p>
							<p className="text-sm text-red-800 dark:text-red-300">
								{overdueCourses.map((c) => c.courseName).join(", ")}
							</p>
						</div>
					</div>
				)}

				<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
					<TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1 dark:bg-slate-900 sm:w-auto">
						<TabsTrigger value="courses" className="gap-2">
							<BookOpen className="h-4 w-4" />
							Courses
						</TabsTrigger>
						<TabsTrigger value="certificates" className="gap-2">
							<Award className="h-4 w-4" />
							Certificates
						</TabsTrigger>
						<TabsTrigger value="history" className="gap-2">
							<History className="h-4 w-4" />
							Quiz History
						</TabsTrigger>
						<TabsTrigger value="profile" className="gap-2">
							<UserRound className="h-4 w-4" />
							Profile
						</TabsTrigger>
					</TabsList>

					<TabsContent value="courses" className="space-y-4">
						<div className="flex gap-2 overflow-x-auto pb-1">
							{(["all", "in-progress", "completed", "overdue"] as const).map((status) => (
								<button
									key={status}
									onClick={() => selectCourseFilter(status)}
									className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-all ${
										filterStatus === status
											? "bg-blue-600 text-white shadow-md"
											: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
									}`}
								>
									{status === "all" && "All Courses"}
									{status === "in-progress" && "In Progress"}
									{status === "completed" && "Completed"}
									{status === "overdue" && "Overdue"}
								</button>
							))}
						</div>

						<div ref={coursesSectionRef} className="scroll-mt-24 grid gap-3">
							{filteredCourses.length > 0 ? (
								filteredCourses.map((course) => {
									const courseCompleted = isCourseCompleted(course);
									const isCourseOverdue =
										course.dueDate &&
										!courseCompleted &&
										isPast(new Date(course.dueDate));

									return (
										<details
											key={course.assignmentId}
											className="group overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
										>
											<summary className="cursor-pointer list-none border-b border-slate-200 px-4 py-3 dark:border-slate-700 [&::-webkit-details-marker]:hidden">
												<div className="grid gap-3 lg:grid-cols-[1fr_220px] lg:items-center">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<h2
																className="truncate text-base font-bold text-slate-900 dark:text-white"
																title={course.description}
															>
																{course.courseName}
															</h2>
															<Badge className="border-0 bg-blue-100 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
																{course.category}
															</Badge>
															<span className="text-xs text-slate-500 dark:text-slate-400">
																{course.completedTopics}/{course.totalTopics} lessons
															</span>
															{course.totalParts > course.totalTopics && (
																<span className="text-xs text-slate-500 dark:text-slate-400">
																	{course.completedParts}/{course.totalParts} parts
																</span>
															)}
															{course.dueDate && (
																<span
																	className={`inline-flex items-center gap-1 text-xs ${
																		isCourseOverdue
																			? "font-semibold text-red-600 dark:text-red-400"
																			: "text-slate-500 dark:text-slate-400"
																	}`}
																>
																	<CalendarDays className="h-3.5 w-3.5" />
																	{format(new Date(course.dueDate), "MMM d")}
																</span>
															)}
														</div>
														<p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
															{course.description}
														</p>
													</div>
													<div className="flex items-center gap-3">
														<div className="min-w-0 flex-1">
														<div className="mb-1 flex items-center justify-between text-xs">
															<span className="font-medium text-slate-500 dark:text-slate-400">
																Progress
															</span>
															<span className="font-bold text-slate-900 dark:text-white">
																{course.progress}%
															</span>
														</div>
														<div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
															<div
																className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
																style={{ width: `${course.progress}%` }}
															/>
														</div>
														</div>
														<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
													</div>
												</div>
											</summary>

											<div className="divide-y divide-slate-200 dark:divide-slate-800">
												{course.topics.length > 0 ? (
													course.topics.map((topic, topicIndex) => {
														const completedMaterials = topic.materials.filter(
															(material) => material.completed,
														).length;

														return (
															<div
																key={topic.id}
																className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/45 lg:grid-cols-[220px_1fr]"
															>
																<div className="min-w-0">
																	<div className="flex items-center gap-2">
																		<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
																			{topicIndex + 1}
																		</span>
																		<div className="min-w-0">
																			<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
																				{topic.title}
																			</p>
																			<p className="text-xs text-slate-500 dark:text-slate-400">
																				{completedMaterials}/{topic.materials.length} items
																			</p>
																		</div>
																	</div>
																</div>
																<div className="min-w-0 space-y-2">
																	<div className="flex flex-wrap gap-2">
																		{topic.materials.map((material) => (
																			<button
																				key={material.id}
																				type="button"
																				disabled={
																					material.type === "PRACTICAL" &&
																					material.completed
																				}
																				onClick={() => openMaterial(material)}
																				className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
																					material.completed
																						? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300"
																						: "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
																				}`}
																				title={material.title}
																			>
																				{material.type === "PRACTICAL" ? (
																					<MapPinCheck className="h-3.5 w-3.5 shrink-0" />
																				) : material.type === "VIDEO" ? (
																					<PlayCircle className="h-3.5 w-3.5 shrink-0" />
																				) : (
																					<FileText className="h-3.5 w-3.5 shrink-0" />
																				)}
																				<span className="truncate">{material.title}</span>
																				<span className="shrink-0 opacity-70">
																					{material.completed
																						? "Done"
																						: getMaterialStatusLabel(material)}
																				</span>
																			</button>
																		))}
																	</div>
																	{topic.quiz && topic.quizAvailable && (
																		<InlineQuiz
																			quiz={topic.quiz}
																			onComplete={refreshDashboard}
																		/>
																	)}
																</div>
															</div>
														);
													})
												) : null}
												{course.courseQuiz && course.courseQuizAvailable && (
														<div className="px-4 py-3">
															<InlineQuiz
																quiz={course.courseQuiz}
																onComplete={refreshDashboard}
															/>
														</div>
													)}
											</div>
										</details>
									);
								})
							) : (
								<Card className="p-12 text-center border-slate-200 dark:border-slate-700">
									<BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-400 dark:text-slate-600" />
									<h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
										No courses found
									</h2>
									<p className="text-slate-600 dark:text-slate-400">
										{filterStatus === "in-progress" &&
											"You have no courses in progress"}
										{filterStatus === "completed" &&
											"You have no completed courses"}
										{filterStatus === "overdue" &&
											"You have no overdue courses"}
										{filterStatus === "all" &&
											"Your supervisor will assign courses here"}
									</p>
								</Card>
							)}
						</div>
					</TabsContent>

					<TabsContent value="certificates">
						<CertificatesPanel />
					</TabsContent>

					<TabsContent value="history">
						<QuizHistoryPanel />
					</TabsContent>

					<TabsContent value="profile">
						<ProfilePanel />
					</TabsContent>
				</Tabs>
			</div>
			<MaterialViewer
				key={selectedMaterial?.id ?? "material-viewer"}
				material={selectedMaterial}
				onClose={() => setSelectedMaterial(null)}
				onOpened={refreshDashboard}
				onComplete={refreshDashboard}
			/>
			{selectedPractical?.progressId && (
				<SignOffModal
					progressId={selectedPractical.progressId}
					traineeId="self"
					isOpen={!!selectedPractical}
					onClose={() => setSelectedPractical(null)}
					onSuccess={refreshDashboard}
				/>
			)}
		</div>
	);
};

interface MetricCardProps {
	icon: React.ReactNode;
	label: string;
	value: number;
	color: "blue" | "green" | "purple" | "orange";
	active?: boolean;
	onClick?: () => void;
}

const MetricCard = ({
	icon,
	label,
	value,
	color,
	active = false,
	onClick,
}: MetricCardProps) => {
	const colorClasses = {
		blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
		green:
			"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
		purple:
			"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
		orange:
			"bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
	};

	return (
		<Card
			className={`p-6 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow ${
				active ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""
			}`}
		>
			<div className="flex items-center gap-4">
				<div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>
				<div>
					<p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
						{label}
					</p>
					{onClick ? (
						<button
							type="button"
							onClick={onClick}
							className="text-3xl font-bold text-slate-900 underline decoration-blue-300 decoration-2 underline-offset-4 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-white dark:hover:text-blue-300 dark:focus:ring-offset-slate-900"
							aria-label={`Show ${label.toLowerCase()} courses`}
						>
							{value}
						</button>
					) : (
						<p className="text-3xl font-bold text-slate-900 dark:text-white">
							{value}
						</p>
					)}
				</div>
			</div>
		</Card>
	);
};

const DashboardSkeleton = () => (
	<div className="mx-auto max-w-7xl px-4 py-8">
		<div className="space-y-6">
			<div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
			<div className="grid gap-4 md:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i} className="p-6">
						<div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
					</Card>
				))}
			</div>
			<Card className="p-8">
				<div className="h-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
			</Card>
		</div>
	</div>
);
