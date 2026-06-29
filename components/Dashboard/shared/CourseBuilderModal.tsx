"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Plus } from "lucide-react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	createDefaultCourseForm,
	createDefaultTopic,
	normalizeCourseForEditor,
} from "./course-builder/defaults";
import { LessonEditor } from "./course-builder/LessonEditor";
import type { CourseFormDraft, TopicDraft } from "./course-builder/types";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	editingCourse?: EditableCourse | null;
}

type EditableCourse = {
	id: string;
	[key: string]: unknown;
};

type UploadResponse = {
	url: string;
	name: string;
	type: TopicDraft["materials"][number]["type"];
	storageProvider: string;
	storagePath: string;
	storageKey: string;
	fileSize: number;
	contentType: string;
	uploadedAt: string;
};

const categories = [
	"Medicine",
	"Nutraceuticals",
	"Medicated Cosmetics",
	"Soft Skills",
];

export function CourseBuilderModal({ isOpen, onClose, editingCourse }: Props) {
	const queryClient = useQueryClient();
	const [uploadingFileId, setUploadingFileId] = useState<string | null>(null);
	const [courseForm, setCourseForm] = useState<CourseFormDraft>(
		createDefaultCourseForm,
	);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCourseForm(
			editingCourse
				? normalizeCourseForEditor(editingCourse)
				: createDefaultCourseForm(),
		);
	}, [editingCourse, isOpen]);

	const saveCourse = useMutation({
		mutationFn: async (data: CourseFormDraft) => {
			if (editingCourse) {
				return (
					await axios.patch(`/api/supervisor/courses/${editingCourse.id}`, data)
				).data;
			}
			return (await axios.post("/api/supervisor/courses", data)).data;
		},
		onSuccess: () => {
			toast.success(editingCourse ? "Course updated" : "Course published");
			void queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
			void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
			void queryClient.invalidateQueries({ queryKey: ["pharmacist-dashboard"] });
			onClose();
		},
		onError: (err: unknown) => {
			toast.error(getApiErrorMessage(err, "Failed to save course"));
		},
	});

	const updateTopic = (index: number, topic: TopicDraft) => {
		setCourseForm((current) => ({
			...current,
			topics: current.topics.map((item, itemIndex) =>
				itemIndex === index ? topic : item,
			),
		}));
	};

	const removeTopic = (index: number) => {
		setCourseForm((current) => {
			const topics = current.topics.filter((_, itemIndex) => itemIndex !== index);
			return {
				...current,
				topics: topics.length ? topics : [createDefaultTopic()],
			};
		});
	};

	const handleFileUpload = async (
		event: ChangeEvent<HTMLInputElement>,
		topicIndex: number,
		materialIndex: number,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setUploadingFileId(`${topicIndex}-${materialIndex}`);
		const formData = new FormData();
		formData.append("file", file);
		formData.append(
			"type",
			courseForm.topics[topicIndex]?.materials[materialIndex]?.type || "",
		);

		try {
			const response = await axios.post<UploadResponse>("/api/upload", formData);
			setCourseForm((current) => ({
				...current,
				topics: current.topics.map((topic, tIndex) =>
					tIndex === topicIndex
						? {
								...topic,
								materials: topic.materials.map((material, mIndex) =>
									mIndex === materialIndex
										? {
												...material,
												url: response.data.url,
												title: material.title || response.data.name,
												type: response.data.type || material.type,
												storageProvider: response.data.storageProvider,
												storagePath: response.data.storagePath,
												storageKey: response.data.storageKey,
												fileSize: response.data.fileSize,
												contentType: response.data.contentType,
												uploadedAt: response.data.uploadedAt,
											}
										: material,
								),
							}
						: topic,
				),
			}));
			toast.success("File uploaded");
		} catch (err: unknown) {
			toast.error(getApiErrorMessage(err, "File upload failed"));
		} finally {
			setUploadingFileId(null);
			event.target.value = "";
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-border bg-card text-foreground">
				<DialogHeader>
					<DialogTitle>
						{editingCourse ? "Edit Curriculum" : "Create Curriculum"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-5 py-2">
					<div className="grid gap-3 md:grid-cols-[1fr_220px]">
						<label className="space-y-1 text-sm font-medium">
							<span>Course Title</span>
							<Input
								value={courseForm.title}
								onChange={(event) =>
									setCourseForm({
										...courseForm,
										title: event.target.value,
									})
								}
							/>
						</label>
						<label className="space-y-1 text-sm font-medium">
							<span>Category</span>
							<select
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={courseForm.category}
								onChange={(event) =>
									setCourseForm({
										...courseForm,
										category: event.target.value,
									})
								}
							>
								{categories.map((category) => (
									<option key={category} value={category}>
										{category}
									</option>
								))}
							</select>
						</label>
					</div>

					<label className="block space-y-1 text-sm font-medium">
						<span>Course Description</span>
						<Input
							value={courseForm.description}
							onChange={(event) =>
								setCourseForm({
									...courseForm,
									description: event.target.value,
								})
							}
						/>
					</label>

					<div className="space-y-3">
						<div className="flex items-center justify-between border-b border-border pb-2">
							<h3 className="text-base font-semibold">Lessons</h3>
							<Button
								type="button"
								size="sm"
								onClick={() =>
									setCourseForm({
										...courseForm,
										topics: [...courseForm.topics, createDefaultTopic()],
									})
								}
							>
								<Plus className="mr-1 h-4 w-4" />
								Add Lesson
							</Button>
						</div>

						{courseForm.topics.map((topic, index) => (
							<LessonEditor
								key={index}
								topic={topic}
								index={index}
								canRemove={courseForm.topics.length > 1}
								uploadingFileId={uploadingFileId}
								onChange={(nextTopic) => updateTopic(index, nextTopic)}
								onRemove={() => removeTopic(index)}
								onUpload={handleFileUpload}
							/>
						))}
					</div>
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => saveCourse.mutate(courseForm)}
						disabled={saveCourse.isPending}
					>
						{saveCourse.isPending
							? "Saving..."
							: editingCourse
								? "Save Changes"
								: "Publish Course"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function getApiErrorMessage(error: unknown, fallback: string) {
	if (axios.isAxiosError(error)) {
		const message = error.response?.data?.message;
		return typeof message === "string" ? message : fallback;
	}
	return fallback;
}
