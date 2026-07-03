"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
	BookOpen,
	CheckCircle2,
	Plus,
	UserCheck,
	Users,
	MapPinCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddTraineeModal } from "@/components/Dashboard/supervisor/AddTraineeModal";
import { AssignCourseModal } from "@/components/Dashboard/supervisor/AssignCourseModal";
import { BulkAssignModal } from "@/components/Dashboard/supervisor/BulkAssignModal";
import { CourseBuilderModal } from "@/components/Dashboard/shared/CourseBuilderModal";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { SupervisorAnalytics } from "@/components/analytics/SupervisorAnalytics";
import { SupervisorStats } from "./supervisor/SupervisorStats";
import { SupervisorTraineeList } from "./supervisor/SupervisorTraineeList";
import { SupervisorCourseList } from "./supervisor/SupervisorCourseList";

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

type CourseSummary = {
	id: string;
	title: string;
	category: string;
	_count?: { assignments: number };
};

type SupervisorOverview = {
	groupTrainees: any[];
	courses: CourseSummary[];
};

export function SupervisorDashboard() {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
	const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
	const [isAddTraineeOpen, setIsAddTraineeOpen] = useState(false);
	const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
	const [editingCourse, setEditingCourse] = useState<CourseSummary | null>(null);
	const [assigningCourse, setAssigningCourse] = useState<CourseSummary | null>(null);

	useRealtimeQueryInvalidation({
		events: supervisorRealtimeEvents,
		queryKeys: supervisorRealtimeQueryKeys,
	});

	const { data, isLoading } = useQuery<SupervisorOverview>({
		queryKey: ["supervisor-overview"],
		queryFn: async () => (await axios.get("/api/supervisor/overview")).data,
		refetchInterval: 120_000,
	});

	const { data: onsiteData, isLoading: isOnsiteLoading } = useQuery({
		queryKey: ["onsite-training"],
		queryFn: async () => (await axios.get("/api/supervisor/onsite-training")).data,
		refetchInterval: 120_000,
	});

	const removeTrainee = useMutation({
		mutationFn: async (id: string) => axios.patch("/api/supervisor/trainees", { pharmacistId: id }),
		onSuccess: () => {
			toast.success("Pharmacist removed");
			queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
		},
	});

	const deleteCourse = useMutation({
		mutationFn: async (id: string) => axios.delete(`/api/supervisor/courses/${id}`),
		onSuccess: () => {
			toast.success("Course deleted");
			queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
		},
	});

	const approveOnsiteTraining = useMutation({
		mutationFn: async (progressId: string) => axios.patch("/api/supervisor/onsite-training", { progressId }),
		onSuccess: () => {
			toast.success("Onsite training approved");
			queryClient.invalidateQueries({ queryKey: ["onsite-training"] });
			queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
		},
	});

	const trainees = data?.groupTrainees ?? [];
	const courses = data?.courses ?? [];
	const onsiteTraining = (onsiteData?.onsiteTraining as any[]) ?? [];
	const pendingOnsite = onsiteTraining.filter((item) => !item.completed).length;

	const metrics = useMemo(() => {
		const assignments = trainees.flatMap((t: any) => t.assignments || []);
		return {
			pharmacists: trainees.length,
			courses: courses.length,
			assignments: assignments.length,
			completed: assignments.filter((a: any) => a.progress === 100).length,
			atRisk: assignments.filter((a: any) => a.progress < 100).length,
			pendingOnsite,
		};
	}, [trainees, courses.length, pendingOnsite]);

	return (
		<div className="min-h-screen bg-background p-4 md:p-8">
			<div className="mx-auto max-w-7xl space-y-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium text-muted-foreground">Supervisor Dashboard</p>
						<h1 className="text-3xl font-bold text-foreground">Training Control</h1>
					</div>
					<div className="flex gap-2 flex-wrap">
						<Button onClick={() => setIsAddTraineeOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Pharmacist</Button>
						<Button variant="outline" onClick={() => setIsBulkAssignOpen(true)}><Users className="mr-1 h-4 w-4" />Bulk Assign</Button>
						<Button onClick={() => { setEditingCourse(null); setIsAddCourseOpen(true); }}><BookOpen className="mr-1 h-4 w-4" />Build Course</Button>
					</div>
				</div>

				<div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
					{[
						{ id: "overview", label: "Team & Courses", icon: Users },
						{ id: "analytics", label: "Analytics", icon: GraduationCap },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id as any)}
							className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
								activeTab === tab.id ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
							}`}
						>
							<tab.icon className="h-4 w-4" />{tab.label}
						</button>
					))}
				</div>

				{activeTab === "analytics" ? (
					<SupervisorAnalytics />
				) : (
					<>
						<SupervisorStats metrics={metrics} />

						<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
							<SupervisorTraineeList
								trainees={trainees}
								isLoading={isLoading}
								onRemove={(id) => { if(confirm("Remove this pharmacist?")) removeTrainee.mutate(id); }}
							/>
							<SupervisorCourseList
								courses={courses}
								onAssign={setAssigningCourse}
								onEdit={(c) => { setEditingCourse(c); setIsAddCourseOpen(true); }}
								onDelete={(id) => { if(confirm("Delete this course?")) deleteCourse.mutate(id); }}
							/>
						</div>

						<details className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border p-4 [&::-webkit-details-marker]:hidden">
								<div className="flex items-center gap-2">
									<MapPinCheck className="h-5 w-5 text-emerald-600" />
									<div>
										<h2 className="text-lg font-semibold">Onsite Training</h2>
										<p className="text-sm text-muted-foreground">Approve practical training.</p>
									</div>
								</div>
								<Badge variant={pendingOnsite > 0 ? "destructive" : "secondary"}>{pendingOnsite} pending</Badge>
							</summary>
							<div className="divide-y divide-border">
								{isOnsiteLoading && <p className="p-6 text-sm text-muted-foreground">Loading...</p>}
								{!isOnsiteLoading && onsiteTraining.length === 0 && <p className="p-6 text-sm text-muted-foreground">No tasks assigned.</p>}
								{onsiteTraining.map((item) => (
									<div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
										<div className="min-w-0">
											<div className="mb-1 flex items-center gap-2">
												<p className="text-sm font-semibold">{item.task.title}</p>
												<Badge variant={item.completed ? "default" : "secondary"}>{item.completed ? "Approved" : item.status}</Badge>
											</div>
											<p className="text-xs text-muted-foreground">{item.pharmacist.name || item.pharmacist.email} · {item.task.courseTitle}</p>
										</div>
										{item.completed ? (
											<div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300"><CheckCircle2 className="h-3 w-3" />Done</div>
										) : (
											<Button size="sm" onClick={() => approveOnsiteTraining.mutate(item.id)} disabled={approveOnsiteTraining.isPending}><UserCheck className="mr-1 h-3 w-3" />Approve</Button>
										)}
									</div>
								))}
							</div>
						</details>
					</>
				)}

				<AddTraineeModal isOpen={isAddTraineeOpen} onClose={() => setIsAddTraineeOpen(false)} />
				<BulkAssignModal isOpen={isBulkAssignOpen} onClose={() => setIsBulkAssignOpen(false)} pharmacists={trainees} courses={courses} />
				{assigningCourse && <AssignCourseModal course={assigningCourse} trainees={trainees} onClose={() => setAssigningCourse(null)} />}
				<CourseBuilderModal isOpen={isAddCourseOpen} editingCourse={editingCourse} onClose={() => { setIsAddCourseOpen(false); setEditingCourse(null); }} />
			</div>
		</div>
	);
}

function GraduationCap(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  )
}
