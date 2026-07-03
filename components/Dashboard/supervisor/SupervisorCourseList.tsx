"use client";

import { GraduationCap, ChevronDown, UserCheck, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

type CourseSummary = {
	id: string;
	title: string;
	category: string;
	_count?: { assignments: number };
};

interface SupervisorCourseListProps {
	courses: CourseSummary[];
	onAssign: (course: CourseSummary) => void;
	onEdit: (course: CourseSummary) => void;
	onDelete: (id: string) => void;
}

export function SupervisorCourseList({ courses, onAssign, onEdit, onDelete }: SupervisorCourseListProps) {
	const [search, setSearch] = useState("");

	const filteredCourses = useMemo(
		() =>
			courses.filter((course) =>
				course.title.toLowerCase().includes(search.toLowerCase()),
			),
		[courses, search],
	);

	return (
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
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>
			<div className="max-h-[650px] divide-y divide-border overflow-y-auto">
				{filteredCourses.length === 0 && (
					<p className="p-6 text-center text-sm text-muted-foreground">No courses found.</p>
				)}
				{filteredCourses.map((course) => (
					<div key={course.id} className="flex items-center justify-between gap-3 p-4">
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold">{course.title}</p>
							<div className="mt-1 flex flex-wrap gap-2">
								<Badge variant="secondary">{course.category}</Badge>
								<Badge variant="outline">{course._count?.assignments ?? 0} assigned</Badge>
							</div>
						</div>
						<div className="flex shrink-0 gap-2">
							<Button type="button" size="sm" onClick={() => onAssign(course)}>
								<UserCheck className="h-4 w-4" />
							</Button>
							<Button type="button" size="sm" variant="outline" onClick={() => onEdit(course)}>
								<Edit2 className="h-4 w-4" />
							</Button>
							<Button type="button" size="sm" variant="destructive" onClick={() => onDelete(course.id)}>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
				))}
			</div>
		</details>
	);
}
