"use client";

import { FileText, HelpCircle, MapPinCheck, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

export function CourseTopicList({
	topics,
	quizzes = [],
}: {
	topics: CourseTopic[];
	quizzes?: Array<{ id: string; topicId?: string | null; title?: string }>;
}) {
	const quizLookup = quizzes ?? [];

	return (
		<div className="space-y-2">
			{topics.length === 0 && (
				<p className="py-4 text-center text-sm text-muted-foreground">
					No topics in this course yet.
				</p>
			)}
			{topics.map((topic, topicIndex) => {
				const matched =
					(topic.quiz ?? topic.requiredQuiz) ??
					quizLookup.find((quiz) => quiz.topicId === topic.id);
				return (
					<div
						key={topic.id}
						className="rounded-lg border border-border bg-muted/20 p-3"
					>
						<div className="flex flex-wrap items-center gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
								{topicIndex + 1}
							</span>
							<p className="truncate text-sm font-medium">{topic.title}</p>
							{matched && (
								<Badge variant="outline" className="ml-auto text-[10px]">
									<HelpCircle className="mr-1 h-3 w-3" />
									{matched.title ?? "Quiz"}
								</Badge>
							)}
						</div>
						{(topic.materials ?? []).length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1.5">
								{(topic.materials ?? []).map((material) => (
									<span
										key={material.id}
										className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
									>
										{materialIcon(material.type)}
										{material.title}
									</span>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

type CourseTopic = {
	id: string;
	title: string;
	description?: string | null;
	materials: Array<{ id: string; title: string; type: string }>;
	quiz?: { id: string; title?: string } | null;
	requiredQuiz?: { id: string; title?: string } | null;
};