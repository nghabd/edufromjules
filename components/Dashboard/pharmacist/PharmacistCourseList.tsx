"use client";

import { format, isPast } from "date-fns";
import {
	BookOpen,
	CalendarDays,
	ChevronDown,
	FileText,
	MapPinCheck,
	PlayCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InlineQuiz } from "@/components/lesson/InlineQuiz";

type Material = {
	progressId: string | null;
	id: string;
	title: string;
	type: string;
	url: string;
	opened: boolean;
	completed: boolean;
};

type Quiz = {
	id: string;
	title: string;
	passingScore: number;
	timeLimit: number;
	bestScore: number;
	questions: any[];
};

type Topic = {
	id: string;
	title: string;
	materials: Material[];
	quizAvailable: boolean;
	quiz: Quiz | null;
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
	courseQuiz: Quiz | null;
};

interface PharmacistCourseListProps {
	courses: AssignedCourse[];
	onOpenMaterial: (material: Material) => void;
	onRefresh: () => void;
}

export function PharmacistCourseList({ courses, onOpenMaterial, onRefresh }: PharmacistCourseListProps) {
	if (courses.length === 0) {
		return (
			<Card className="p-12 text-center border-slate-200 dark:border-slate-700">
				<BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-400 dark:text-slate-600" />
				<h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
					No courses found
				</h2>
				<p className="text-slate-600 dark:text-slate-400">
					Your supervisor will assign courses here
				</p>
			</Card>
		);
	}

	return (
		<div className="grid gap-3">
			{courses.map((course) => {
				const isCourseCompleted = course.completed || course.progress >= 100;
				const isCourseOverdue = course.dueDate && !isCourseCompleted && isPast(new Date(course.dueDate));

				return (
					<details
						key={course.assignmentId}
						className="group overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
					>
						<summary className="cursor-pointer list-none border-b border-slate-200 px-4 py-3 dark:border-slate-700 [&::-webkit-details-marker]:hidden">
							<div className="grid gap-3 lg:grid-cols-[1fr_220px] lg:items-center">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<h2 className="truncate text-base font-bold text-slate-900 dark:text-white">
											{course.courseName}
										</h2>
										<Badge className="border-0 bg-blue-100 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
											{course.category}
										</Badge>
										<span className="text-xs text-slate-500 dark:text-slate-400">
											{course.completedTopics}/{course.totalTopics} lessons
										</span>
										{course.dueDate && (
											<span className={`inline-flex items-center gap-1 text-xs ${isCourseOverdue ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
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
											<span className="font-medium text-slate-500 dark:text-slate-400">Progress</span>
											<span className="font-bold text-slate-900 dark:text-white">{course.progress}%</span>
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
							{course.topics.map((topic, topicIndex) => {
								const completedMaterials = topic.materials.filter((m) => m.completed).length;
								return (
									<div key={topic.id} className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/45 lg:grid-cols-[220px_1fr]">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
													{topicIndex + 1}
												</span>
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{topic.title}</p>
													<p className="text-xs text-slate-500 dark:text-slate-400">{completedMaterials}/{topic.materials.length} items</p>
												</div>
											</div>
										</div>
										<div className="min-w-0 space-y-2">
											<div className="flex flex-wrap gap-2">
												{topic.materials.map((material) => (
													<button
														key={material.id}
														type="button"
														disabled={material.type === "PRACTICAL" && material.completed}
														onClick={() => onOpenMaterial(material)}
														className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
															material.completed
																? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300"
																: "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
														}`}
													>
														{material.type === "PRACTICAL" ? (
															<MapPinCheck className="h-3.5 w-3.5 shrink-0" />
														) : material.type === "VIDEO" ? (
															<PlayCircle className="h-3.5 w-3.5 shrink-0" />
														) : (
															<FileText className="h-3.5 w-3.5 shrink-0" />
														)}
														<span className="truncate">{material.title}</span>
													</button>
												))}
											</div>
											{topic.quiz && topic.quizAvailable && (
												<InlineQuiz quiz={topic.quiz} onComplete={onRefresh} />
											)}
										</div>
									</div>
								);
							})}
							{course.courseQuiz && course.courseQuizAvailable && (
								<div className="px-4 py-3">
									<InlineQuiz quiz={course.courseQuiz} onComplete={onRefresh} />
								</div>
							)}
						</div>
					</details>
				);
			})}
		</div>
	);
}
