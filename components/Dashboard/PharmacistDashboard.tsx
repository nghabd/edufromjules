"use client";

import React, { useCallback, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
	Award,
	BookOpen,
	History,
	AlertCircle,
	UserRound,
} from "lucide-react";
import { isPast } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialViewer } from "@/components/lesson/MaterialViewer";
import { SignOffModal } from "@/components/lesson/SignOffModal";
import { CertificatesPanel } from "@/components/certificates/CertificatesPanel";
import { QuizHistoryPanel } from "@/components/quiz/QuizHistoryPanel";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { PharmacistStats } from "./pharmacist/PharmacistStats";
import { PharmacistCourseList } from "./pharmacist/PharmacistCourseList";

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
	type: string;
	url: string;
	opened: boolean;
	completed: boolean;
};

type Topic = {
	id: string;
	title: string;
	materials: Material[];
	quizAvailable: boolean;
	quiz: any | null;
};

type AssignedCourse = {
	assignmentId: string;
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
	courseQuiz: any | null;
};

type DashboardData = {
	assignedCourses: AssignedCourse[];
	coursesInProgress: AssignedCourse[];
	completedCourses: AssignedCourse[];
	upcomingDeadlines: AssignedCourse[];
	overdueCourses: AssignedCourse[];
};

type CourseFilter = "all" | "in-progress" | "completed" | "overdue";

export const PharmacistDashboard: React.FC = () => {
	const queryClient = useQueryClient();
	const coursesSectionRef = useRef<HTMLDivElement | null>(null);
	const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
	const [selectedPractical, setSelectedPractical] = useState<Material | null>(null);
	const [filterStatus, setFilterStatus] = useState<CourseFilter>("all");
	const [activeTab, setActiveTab] = useState("courses");

	const refreshDashboard = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: ["pharmacist-dashboard"] });
	}, [queryClient]);

	const handleOpenMaterial = (material: Material) => {
		if (material.type === "PRACTICAL") {
			if (material.completed) {
				toast.success("Onsite training already approved.");
				return;
			}
			if (!material.progressId) {
				toast.error("Onsite task is still preparing.");
				return;
			}
			setSelectedPractical(material);
			return;
		}
		setSelectedMaterial(material as any);
	};

	useRealtimeQueryInvalidation({
		events: pharmacistRealtimeEvents,
		queryKeys: pharmacistRealtimeQueryKeys,
	});

	const { data, isLoading, error } = useQuery<DashboardData>({
		queryKey: ["pharmacist-dashboard"],
		queryFn: async () => (await axios.get("/api/pharmacist/dashboard")).data,
		refetchInterval: 120_000,
	});

	const isCourseCompleted = (course: AssignedCourse) => course.completed || course.progress >= 100;

	const filteredCourses = useMemo(() => {
		const all = data?.assignedCourses ?? [];
		if (filterStatus === "all") return all;
		if (filterStatus === "in-progress") return all.filter(c => !isCourseCompleted(c));
		if (filterStatus === "completed") return all.filter(c => isCourseCompleted(c));
		if (filterStatus === "overdue") return all.filter(c => c.dueDate && !isCourseCompleted(c) && isPast(new Date(c.dueDate)));
		return all;
	}, [data?.assignedCourses, filterStatus]);

	if (isLoading) return <DashboardSkeleton />;

	if (error) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
					<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
					<p className="text-sm font-medium text-red-900 dark:text-red-200">Failed to load dashboard.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
				<div className="mb-8">
					<p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">Pharmacist Workspace</p>
					<h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">My Learning Journey</h1>
				</div>

				<PharmacistStats
					assignedCount={data?.assignedCourses.length ?? 0}
					inProgressCount={data?.assignedCourses.filter(c => !isCourseCompleted(c)).length ?? 0}
					completedCount={data?.assignedCourses.filter(c => isCourseCompleted(c)).length ?? 0}
					overdueCount={data?.assignedCourses.filter(c => c.dueDate && !isCourseCompleted(c) && isPast(new Date(c.dueDate))).length ?? 0}
					filterStatus={filterStatus}
					onFilterChange={setFilterStatus}
				/>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
					<TabsList className="bg-white dark:bg-slate-900">
						<TabsTrigger value="courses"><BookOpen className="mr-2 h-4 w-4" />Courses</TabsTrigger>
						<TabsTrigger value="certificates"><Award className="mr-2 h-4 w-4" />Certificates</TabsTrigger>
						<TabsTrigger value="history"><History className="mr-2 h-4 w-4" />History</TabsTrigger>
						<TabsTrigger value="profile"><UserRound className="mr-2 h-4 w-4" />Profile</TabsTrigger>
					</TabsList>

					<TabsContent value="courses">
						<div ref={coursesSectionRef} className="scroll-mt-24">
							<PharmacistCourseList
								courses={filteredCourses}
								onOpenMaterial={handleOpenMaterial}
								onRefresh={refreshDashboard}
							/>
						</div>
					</TabsContent>

					<TabsContent value="certificates"><CertificatesPanel /></TabsContent>
					<TabsContent value="history"><QuizHistoryPanel /></TabsContent>
					<TabsContent value="profile"><ProfilePanel /></TabsContent>
				</Tabs>
			</div>

			<MaterialViewer
				key={selectedMaterial?.id ?? "material-viewer"}
				material={selectedMaterial as any}
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

const DashboardSkeleton = () => (
	<div className="mx-auto max-w-7xl px-4 py-8">
		<div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700 mb-6" />
		<div className="grid gap-4 md:grid-cols-4 mb-8">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
			))}
		</div>
		<div className="h-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
	</div>
);
