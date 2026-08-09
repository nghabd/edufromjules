"use client";

import { ReactNode } from "react";
import { BookOpen, FileText, ListChecks, PlayCircle, MapPinCheck, HelpCircle, Users } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export type CourseDetailTopicMaterial = {
	id: string;
	title: string;
	type: string;
};

export type CourseDetailTopic = {
	id: string;
	title: string;
	description?: string | null;
	materials: CourseDetailTopicMaterial[];
	quiz?: { id: string; title?: string } | null;
	requiredQuiz?: { id: string; title?: string } | null;
};

export type CourseDetailData = {
	id: string;
	title: string;
	description?: string | null;
	category?: string | null;
	topics?: CourseDetailTopic[];
	quizzes?: Array<{
		id: string;
		topicId?: string | null;
		title?: string;
	}>;
	_count?: { assignments?: number };
	[key: string]: unknown;
};

function materialIcon(type: string) {
	switch (type) {
		case "PRACTICAL":
			return <MapPinCheck className="h-3.5 w-3.5 shrink-0" />;
		case "VIDEO":
			return <PlayCircle className="h-3.5 w-3.5 shrink-0" />;
		default:
			return <FileText className="h-3.5 w-3.5 shrink-0" />;
	}
}

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	course: CourseDetailData | null;
	actions?: ReactNode;
};

export function CourseDetailDialog({ open, onOpenChange, course, actions }: Props) {
	const topics = course?.topics ?? [];
	const materialCount = topics.reduce(
		(total, topic) => total + (topic.materials?.length ?? 0),
		0,
	);
	const quizLookup = course?.quizzes ?? [];
	const topicQuizIds = new Set(quizLookup.map((quiz) => quiz.topicId).filter(Boolean));
	const quizCount = topics.reduce((total, topic) => {
		const matched =
			topic.quiz ?? topic.requiredQuiz ??
			(topic.quiz !== undefined || topic.requiredQuiz !== undefined ? true : topicQuizIds.has(topic.id));
		return total + (matched ? 1 : 0);
	}, 0);
	const assignmentCount = course?._count?.assignments ?? 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl border-border bg-card">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<BookOpen className="h-5 w-5 text-primary" />
						{course?.title ?? "Course"}
					</DialogTitle>
					<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						{course?.category && (
							<Badge variant="secondary">{course.category}</Badge>
						)}
						<span className="inline-flex items-center gap-1">
							<ListChecks className="h-3.5 w-3.5" />
							{topics.length} topics
						</span>
						<span className="inline-flex items-center gap-1">
							<FileText className="h-3.5 w-3.5" />
							{materialCount} materials
						</span>
						<span className="inline-flex items-center gap-1">
							<HelpCircle className="h-3.5 w-3.5" />
							{quizCount} quizzes
						</span>
						<span className="inline-flex items-center gap-1">
							<Users className="h-3.5 w-3.5" />
							{assignmentCount} assigned
						</span>
					</div>
				</DialogHeader>

				{course?.description && (
					<p className="text-sm text-muted-foreground">{course.description}</p>
				)}

				<div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
					{topics.length === 0 && (
						<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
							This course has no topics yet.
						</div>
					)}
					{topics.map((topic, topicIndex) => {
						const matched =
							(topic.quiz ?? topic.requiredQuiz) ??
							quizLookup.find((quiz) => quiz.topicId === topic.id);
						return (
							<div
								key={topic.id}
								className="rounded-xl border border-border bg-muted/20 p-4"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
										{topicIndex + 1}
									</span>
									<h4 className="truncate text-sm font-semibold">{topic.title}</h4>
									{matched && (
										<Badge variant="outline" className="text-xs">
											{matched.title ?? "Quiz"}
										</Badge>
									)}
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{(topic.materials ?? []).map((material) => (
										<span
											key={material.id}
											className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
										>
											{materialIcon(material.type)}
											{material.title}
											<span className="rounded bg-muted px-1.5 py-0 text-[10px] font-medium uppercase text-muted-foreground">
												{material.type.replace(/_/g, " ")}
											</span>
										</span>
									))}
								</div>
							</div>
						);
					})}
				</div>

				{actions && <DialogFooter>{actions}</DialogFooter>}
			</DialogContent>
		</Dialog>
	);
}