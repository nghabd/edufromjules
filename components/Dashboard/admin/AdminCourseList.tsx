"use client";

import { BookOpen, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

type AdminCourse = {
	id: string;
	title: string;
	category: string;
	_count?: { assignments: number };
	[key: string]: unknown;
};

interface AdminCourseListProps {
	courses: AdminCourse[];
	onEdit: (course: AdminCourse) => void;
	onDelete: (id: string) => void;
	onAdd: () => void;
}

export function AdminCourseList({ courses, onEdit, onDelete, onAdd }: AdminCourseListProps) {
	const [search, setSearch] = useState("");

	const filteredCourses = useMemo(
		() =>
			courses.filter((c) =>
				c.title.toLowerCase().includes(search.toLowerCase()),
			),
		[courses, search],
	);

	return (
		<details open className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-6 py-4 [&::-webkit-details-marker]:hidden">
				<div>
					<h2 className="flex gap-2 text-lg font-bold">
						<BookOpen className="h-5 w-5 text-green-600" /> Courses
					</h2>
					<p className="text-sm text-muted-foreground">
						{filteredCourses.length} courses
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					className="bg-green-600 text-white hover:bg-green-700"
					onClick={onAdd}
				>
					<Plus className="h-4 w-4" /> Build Course
				</Button>
			</summary>
			<div className="p-6">
				<Input
					placeholder="Search courses..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<div className="mt-4 max-h-[500px] overflow-y-auto divide-y divide-border rounded-xl border border-border">
					{filteredCourses.length === 0 ? (
						<p className="p-8 text-center text-sm text-muted-foreground">No courses found.</p>
					) : (
						filteredCourses.map((course) => (
							<div key={course.id} className="flex items-center justify-between gap-3 p-4">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">{course.title}</p>
									<p className="text-xs text-muted-foreground">{course.category}</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<Button variant="outline" size="icon" onClick={() => onEdit(course)}>
										<Edit2 className="h-3 w-3" />
									</Button>
									<Button variant="destructive" size="icon" onClick={() => onDelete(course.id)}>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</details>
	);
}
