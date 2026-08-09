"use client";

import type { ChangeEvent } from "react";
import { FileText, GripVertical, MapPinCheck, Paperclip, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { createAttachmentMaterial, createArticleMaterial } from "./defaults";
import { QuizEditor } from "./QuizEditor";
import {
	type MaterialDraft,
	type MaterialType,
	type TopicDraft,
	materialTypeLabels,
} from "./types";

type LessonEditorProps = {
	topic: TopicDraft;
	index: number;
	canRemove: boolean;
	uploadingFileId: string | null;
	onChange: (topic: TopicDraft) => void;
	onRemove: () => void;
	onUpload: (
		event: ChangeEvent<HTMLInputElement>,
		topicIndex: number,
		materialIndex: number,
	) => void;
};

const attachmentTypes: MaterialType[] = [
	"PDF",
	"VIDEO",
	"IMAGE",
	"DOCUMENT",
	"PRESENTATION",
	"PRACTICAL",
];

const fileAcceptByType: Partial<Record<MaterialType, string>> = {
	PDF: "application/pdf",
	VIDEO: "video/*",
	IMAGE: "image/*",
	DOCUMENT:
		".doc,.docx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
	PRESENTATION:
		".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const timedGateTypes = new Set<MaterialType>(["PDF", "VIDEO", "IMAGE"]);

export function LessonEditor({
	topic,
	index,
	canRemove,
	uploadingFileId,
	onChange,
	onRemove,
	onUpload,
}: LessonEditorProps) {
	const updateMaterial = (materialIndex: number, patch: Partial<MaterialDraft>) => {
		onChange({
			...topic,
			materials: topic.materials.map((material, index) =>
				index === materialIndex ? { ...material, ...patch } : material,
			),
		});
	};

	const updateTopicTitle = (title: string) => {
		onChange({
			...topic,
			title,
			materials: topic.materials.map((material) =>
				material.type === "RICH_TEXT" &&
				(!material.title ||
					material.title === "Lesson Article" ||
					material.title === topic.title)
					? { ...material, title: title || "Lesson Article" }
					: material,
			),
		});
	};

	const removeMaterial = (materialIndex: number) => {
		const nextMaterials = topic.materials.filter((_, index) => index !== materialIndex);
		onChange({
			...topic,
			materials: nextMaterials.length ? nextMaterials : [createArticleMaterial()],
		});
	};

	const addAttachment = () => {
		onChange({
			...topic,
			materials: [...topic.materials, createAttachmentMaterial()],
		});
	};

	const articleIndexes = topic.materials
		.map((material, materialIndex) => ({ material, materialIndex }))
		.filter(({ material }) => material.type === "RICH_TEXT");
	const attachments = topic.materials
		.map((material, materialIndex) => ({ material, materialIndex }))
		.filter(({ material }) => material.type !== "RICH_TEXT");

	return (
		<Card className="space-y-4 border-border bg-muted/20 p-4">
			<div className="flex items-start justify-between gap-4">
				<div className="grid flex-1 gap-3 md:grid-cols-[1fr_1fr]">
					<label className="space-y-1 text-sm font-medium">
						<span>Lesson {index + 1} Title</span>
						<Input
							value={topic.title}
							onChange={(event) => updateTopicTitle(event.target.value)}
						/>
					</label>
					<label className="space-y-1 text-sm font-medium">
						<span>Description</span>
						<Input
							value={topic.description}
							onChange={(event) =>
								onChange({ ...topic, description: event.target.value })
							}
						/>
					</label>
				</div>
				<div className="flex items-center gap-1">
					<GripVertical className="h-4 w-4 text-muted-foreground" />
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-9 w-9 p-0 text-destructive"
						disabled={!canRemove}
						onClick={onRemove}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="rounded-md border border-border bg-background">
				<div className="flex items-center justify-between gap-3 border-b border-border p-3">
					<div className="flex items-center gap-2">
						<FileText className="h-4 w-4 text-blue-600" />
						<p className="text-sm font-semibold">Article</p>
					</div>
				</div>
				<div className="space-y-3 p-3">
					{articleIndexes.length === 0 && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() =>
								onChange({
									...topic,
									materials: [createArticleMaterial(), ...topic.materials],
								})
							}
						>
							<Plus className="mr-1 h-4 w-4" />
							Add Article
						</Button>
					)}
					{articleIndexes.map(({ material, materialIndex }) => (
						<div key={materialIndex}>
							<RichTextEditor
								value={material.content}
								onChange={(content) => updateMaterial(materialIndex, { content })}
								placeholder="Write the lesson article here..."
							/>
						</div>
					))}
				</div>
			</div>

			<QuizEditor
				quiz={topic.quiz}
				onChange={(quiz) => onChange({ ...topic, quiz })}
			/>

			<div className="rounded-md border border-border bg-background">
				<div className="flex items-center justify-between gap-3 border-b border-border p-3">
					<div className="flex items-center gap-2">
						<Paperclip className="h-4 w-4 text-orange-600" />
						<p className="text-sm font-semibold">Attachments</p>
					</div>
					<Button type="button" size="sm" variant="outline" onClick={addAttachment}>
						<Plus className="mr-1 h-4 w-4" />
						Add
					</Button>
				</div>
				<div className="space-y-3 p-3">
					{attachments.length === 0 && (
						<p className="text-sm text-muted-foreground">No attachments.</p>
					)}
					{attachments.map(({ material, materialIndex }) => (
						<div
							key={materialIndex}
							className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[130px_1fr_auto]"
						>
							<select
								className="h-10 rounded-md border border-input bg-background px-3 text-sm"
								value={material.type}
								onChange={(event) => {
									const nextType = event.target.value as MaterialType;
									updateMaterial(materialIndex, {
										type: nextType,
										url: nextType === "PRACTICAL" ? "" : material.url,
										gateQuestion: timedGateTypes.has(nextType)
											? material.gateQuestion
											: "",
										gateAnswer: timedGateTypes.has(nextType)
											? material.gateAnswer
											: "",
									});
								}}
							>
								{attachmentTypes.map((type) => (
									<option key={type} value={type}>
										{materialTypeLabels[type]}
									</option>
								))}
							</select>
					<div className="space-y-2">
						<Input
							value={material.title}
							placeholder={material.type === "PRACTICAL" ? "Task name" : "Title"}
							onChange={(event) =>
								updateMaterial(materialIndex, { title: event.target.value })
							}
						/>
						{material.type === "PRACTICAL" && (
							<div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
								<div className="flex items-center gap-2">
									<MapPinCheck className="h-4 w-4 text-emerald-600" />
									<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
										Onsite task details
									</p>
								</div>
								<textarea
									value={material.content}
									placeholder="Describe the task, expected actions, and what the trainer should verify."
									onChange={(event) =>
										updateMaterial(materialIndex, { content: event.target.value })
									}
									className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
								/>
								<div className="grid gap-2 md:grid-cols-2">
									<Input
										value={material.gateQuestion || ""}
										placeholder="Optional trainer prompt"
										onChange={(event) =>
											updateMaterial(materialIndex, {
												gateQuestion: event.target.value,
											})
										}
									/>
									<Input
										value={material.gateAnswer || ""}
										placeholder="Optional confirmation keyword"
										onChange={(event) =>
											updateMaterial(materialIndex, {
												gateAnswer: event.target.value,
											})
										}
									/>
								</div>
							</div>
						)}
						{material.type !== "PRACTICAL" && (
							<>
								<div className="flex gap-2">
									<Input
												value={material.url}
												readOnly
												placeholder="Uploaded file URL"
												className="text-xs"
											/>
											<label className="relative inline-flex">
												<Button
													type="button"
													variant="secondary"
													className="w-28"
													disabled={uploadingFileId === `${index}-${materialIndex}`}
												>
													<UploadCloud className="mr-1 h-4 w-4" />
													{uploadingFileId === `${index}-${materialIndex}`
														? "Uploading"
														: "Upload"}
												</Button>
												<input
													type="file"
													accept={
														fileAcceptByType[material.type] ||
														"application/octet-stream"
													}
													className="absolute inset-0 cursor-pointer opacity-0"
													onChange={(event) =>
														onUpload(event, index, materialIndex)
													}
												/>
											</label>
										</div>
										{timedGateTypes.has(material.type) && (
											<div className="grid gap-2 md:grid-cols-2">
												<Input
													value={material.gateQuestion || ""}
													placeholder="Timer question shown before closing"
													onChange={(event) =>
														updateMaterial(materialIndex, {
															gateQuestion: event.target.value,
														})
													}
												/>
												<Input
													value={material.gateAnswer || ""}
													placeholder="Expected answer"
													onChange={(event) =>
														updateMaterial(materialIndex, {
															gateAnswer: event.target.value,
														})
													}
												/>
											</div>
										)}
									</>
								)}
							</div>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-10 w-10 p-0 text-destructive"
								onClick={() => removeMaterial(materialIndex)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
			</div>
		</Card>
	);
}
