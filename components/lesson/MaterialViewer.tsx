"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import axios from "axios";
import toast from "react-hot-toast";
import {
	ChevronLeft,
	ChevronRight,
	Lock,
	Play,
	Volume2,
	VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	decodeRichTextMaterialContent,
	isRichTextMaterialContent,
} from "@/lib/material-content";

// IMPORTANT: This imports the CSS required to render your colors, lists, and formatting correctly
import "react-quill-new/dist/quill.snow.css";

type Material = {
	id: string;
	title: string;
	type: "PDF" | "VIDEO" | "RICH_TEXT" | string;
	url: string;
	content?: string | null; // FIXED: Added the content field from the database
	gateQuestion?: string | null;
};

type Engagement = {
	firstGateCompleted: boolean;
	controlsUnlocked: boolean;
	closeAllowedAt: string | null;
};

const timedMediaTypes = new Set(["PDF", "VIDEO", "IMAGE"]);
const defaultGateQuestion =
	"Before leaving: type learned to confirm you completed this lesson.";

function getMaterialErrorMessage(error: unknown) {
	if (!axios.isAxiosError(error)) {
		return "Could not open this lesson media. Please try again.";
	}

	if (error.response?.status === 404) {
		return "This lesson media is not available for your account. Refresh the dashboard and try again.";
	}

	if (error.response?.status === 403) {
		return "You do not have permission to open this lesson media.";
	}

	return (
		(error.response?.data as { message?: string } | undefined)?.message ||
		"Could not open this lesson media. Please try again."
	);
}

function isTimedMediaMaterial(type?: string) {
	return Boolean(type && timedMediaTypes.has(type));
}

export function MaterialViewer({
	material,
	onClose,
	onOpened,
	onComplete,
}: {
	material: Material | null;
	onClose: () => void;
	onOpened?: (materialId: string) => void;
	onComplete: () => void;
}) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [engagement, setEngagement] = useState<Engagement | null>(null);
	const [materialOpenedAt, setMaterialOpenedAt] = useState<Date | null>(null);
	const [now, setNow] = useState(0);
	const [page, setPage] = useState(1);
	const [videoVolume, setVideoVolume] = useState(0.85);
	const [videoMuted, setVideoMuted] = useState(false);
	const [videoNeedsStart, setVideoNeedsStart] = useState(false);
	const [previewVersion, setPreviewVersion] = useState(0);
	const [resolvedMaterialUrl, setResolvedMaterialUrl] = useState<{
		materialId: string;
		url: string;
	} | null>(null);
	const [resolvedGateQuestion, setResolvedGateQuestion] = useState<{
		materialId: string;
		question: string;
	} | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const materialKey = material?.id;

	useEffect(() => {
		if (!material) return;
		let cancelled = false;
		const resetFrame = window.requestAnimationFrame(() => {
			if (cancelled) return;
			setEngagement(null);
			setNow(0);
			setPage(1);
			setVideoNeedsStart(false);
			setResolvedMaterialUrl(null);
			setResolvedGateQuestion(null);
			setLoadError(null);
		});

		axios
			.get(`/api/materials/${material.id}/engagement`)
			.then((response) => {
				if (cancelled) return;
				setEngagement(response.data.engagement);
				setNow(Date.now());
				setResolvedMaterialUrl({
					materialId: material.id,
					url: response.data.material?.url || material.url,
				});
				setResolvedGateQuestion({
					materialId: material.id,
					question:
						response.data.material?.gateQuestion ||
						material.gateQuestion ||
						defaultGateQuestion,
				});
				onOpened?.(material.id);
			})
			.catch((error) => {
				if (cancelled) return;
				const message = getMaterialErrorMessage(error);
				setLoadError(message);
				setNow(Date.now());
				toast.error(message);
			});

		return () => {
			cancelled = true;
			window.cancelAnimationFrame(resetFrame);
		};
	}, [material, materialKey, onOpened]);

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => {
			setMaterialOpenedAt(material ? new Date() : null);
		});
		return () => window.cancelAnimationFrame(frame);
	}, [material, material?.id]);

	useEffect(() => {
		if (
			!material ||
			!isTimedMediaMaterial(material.type) ||
			engagement?.firstGateCompleted
		)
			return;
		const interval = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(interval);
	}, [engagement?.firstGateCompleted, material]);

	const requiresTimedGate = isTimedMediaMaterial(material?.type);
	const closeAllowedAt = engagement?.closeAllowedAt
		? new Date(engagement.closeAllowedAt).getTime()
		: 0;
	const secondsRemaining = requiresTimedGate && now && engagement
		? Math.max(0, Math.ceil((closeAllowedAt - now) / 1000))
		: 60;
	const canClose =
		!!loadError ||
		!requiresTimedGate ||
		!!engagement?.firstGateCompleted ||
		(!!engagement && secondsRemaining <= 0);
	const hideControls =
		requiresTimedGate &&
		(!engagement ||
			(!engagement.firstGateCompleted && !engagement.controlsUnlocked));
	const materialUrl =
		resolvedMaterialUrl && resolvedMaterialUrl.materialId === material?.id
			? resolvedMaterialUrl.url
			: material?.url || "";
	const gateQuestion =
		resolvedGateQuestion && resolvedGateQuestion.materialId === material?.id
			? resolvedGateQuestion.question
			: material?.gateQuestion || defaultGateQuestion;
	const isFirstTimeVideoGate =
		material?.type === "VIDEO" &&
		requiresTimedGate &&
		!engagement?.firstGateCompleted;
	const showNativeVideoControls =
		material?.type === "VIDEO" && !isFirstTimeVideoGate;

	useEffect(() => {
		if (
			!material ||
			!requiresTimedGate ||
			!engagement ||
			engagement.firstGateCompleted ||
			engagement.controlsUnlocked ||
			secondsRemaining > 0
		)
			return;
		axios
			.patch(`/api/materials/${material.id}/engagement`, { action: "unlock" })
			.then((response) => {
				setEngagement(response.data);
			})
			.catch((error) => {
				toast.error(getMaterialErrorMessage(error));
			});
	}, [engagement, material, requiresTimedGate, secondsRemaining]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || material?.type !== "VIDEO" || !materialUrl || loadError) return;

		video.volume = videoVolume;
		video.muted = videoMuted;
		video.playbackRate = 1;
		video.defaultPlaybackRate = 1;

		if (!isFirstTimeVideoGate) return;

		const playVideo = async () => {
			try {
				await video.play();
				setVideoNeedsStart(false);
			} catch {
				try {
					video.muted = true;
					setVideoMuted(true);
					await video.play();
					setVideoNeedsStart(false);
				} catch {
					setVideoNeedsStart(true);
				}
			}
		};

		void playVideo();
	}, [
		isFirstTimeVideoGate,
		loadError,
		material?.type,
		materialUrl,
		previewVersion,
		videoMuted,
		videoVolume,
	]);

	const startVideo = async () => {
		const video = videoRef.current;
		if (!video) return;
		video.playbackRate = 1;
		video.defaultPlaybackRate = 1;
		try {
			await video.play();
			setVideoNeedsStart(false);
		} catch {
			toast.error("Could not start the video. Please try again.");
		}
	};

	const updateVideoVolume = (value: number) => {
		const nextVolume = Math.max(0, Math.min(1, value));
		setVideoVolume(nextVolume);
		setVideoMuted(nextVolume === 0 ? true : false);
		const video = videoRef.current;
		if (!video) return;
		video.volume = nextVolume;
		video.muted = nextVolume === 0;
	};

	const toggleVideoMuted = () => {
		const nextMuted = !videoMuted;
		setVideoMuted(nextMuted);
		const video = videoRef.current;
		if (!video) return;
		video.muted = nextMuted;
		if (!nextMuted && video.volume === 0) {
			updateVideoVolume(0.5);
		}
	};

	const pdfUrl = useMemo(() => {
		if (!material) return "";
		return `${materialUrl}#toolbar=0&navpanes=0&scrollbar=0&page=${page}`;
	}, [material, materialUrl, page]);

	const richTextHtml = useMemo(() => {
		if (!material) return "";

		if (
			material.type === "RICH_TEXT" ||
			isRichTextMaterialContent(materialUrl)
		) {
			// FIXED: Prioritize the new `content` field. Fall back to decoding the URL if it's a legacy course.
			const rawHtml =
				material.content ||
				(isRichTextMaterialContent(materialUrl)
					? decodeRichTextMaterialContent(materialUrl)
					: "");

			// Include ADD_ATTR so text colors (inline styles) aren't stripped out for security
			return DOMPurify.sanitize(rawHtml, {
				USE_PROFILES: { html: true },
				ADD_ATTR: ["style", "class", "target"],
			});
		}

		return "";
	}, [material, materialUrl]);

	const resetLessonPreview = () => {
		setPage(1);
		setNow(Date.now());
		setPreviewVersion((value) => value + 1);
	};

	const requestClose = async () => {
		if (!material) return;
		if (loadError) {
			onClose();
			return;
		}
		if (!requiresTimedGate) {
			onClose();
			return;
		}
		if (!engagement) {
			toast.error("The lesson timer is starting. Please wait a moment.");
			return;
		}
		if (!canClose) {
			toast.error(
				`Please spend ${secondsRemaining}s more in this lesson before closing.`,
			);
			return;
		}

		if (!engagement.firstGateCompleted) {
			const answer =
				window.prompt(gateQuestion) ?? "";

			let response;
			try {
				response = await axios.patch(
					`/api/materials/${material.id}/engagement`,
					{
						action: "prompt",
						answer,
					},
				);
			} catch {
				toast.error("Could not validate lesson completion. Please try again.");
				return;
			}

			if (!response.data.correct) {
				setEngagement(response.data.engagement);
				resetLessonPreview();
				toast.error(
					"Answer missing or incorrect. Review the media and try again when ready.",
				);
				return;
			}

			toast.success("Lesson completed.");

			// Track time spent on material
			if (materialOpenedAt) {
				const timeSpentSeconds = Math.round(
					(Date.now() - materialOpenedAt.getTime()) / 1000,
				);
				axios
					.patch(`/api/materials/${material.id}/progress`, {
						timeSpent: timeSpentSeconds,
					})
					.catch((err) => console.error("[TIME_TRACKING_FAILED]", err));
			}

			onComplete();
		}

		onClose();
	};

	return (
		<Dialog open={!!material} onOpenChange={(open) => !open && requestClose()}>
			<DialogContent
				hideClose={!canClose}
				className="max-h-[94vh] max-w-6xl overflow-hidden p-0"
			>
				<DialogHeader className="border-b border-slate-200 px-5 py-4">
					<DialogTitle>{material?.title}</DialogTitle>
					<DialogDescription className="flex items-center gap-2">
						{loadError && "Media unavailable"}
						{!loadError && !canClose && (
							<>
								<Lock className="h-4 w-4" />
								Close unlocks in {secondsRemaining}s
							</>
						)}
						{!loadError && canClose && material?.type === "VIDEO" && "Video lesson"}
						{!loadError && canClose && material?.type === "PDF" && "PDF lesson"}
						{!loadError && canClose && material?.type === "IMAGE" && "Image lesson"}
						{!loadError &&
							canClose &&
							material?.type === "RICH_TEXT" &&
							"Rich-text lesson"}
					</DialogDescription>
				</DialogHeader>

				{loadError ? (
					<div className="flex h-[74vh] flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-950">
						<div className="max-w-md">
							<p className="text-base font-semibold text-slate-900 dark:text-white">
								Media unavailable
							</p>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
								{loadError}
							</p>
						</div>
						<Button onClick={onClose}>Close</Button>
					</div>
				) : material?.type === "VIDEO" ? (
					<div className="relative h-[74vh] bg-black">
						<video
							ref={videoRef}
							key={`${material.id}-${previewVersion}`}
							className="h-full w-full bg-black"
							autoPlay={isFirstTimeVideoGate}
							playsInline
							preload="auto"
							controls={showNativeVideoControls}
							controlsList="nodownload noplaybackrate"
							disablePictureInPicture
							onContextMenu={(event) => event.preventDefault()}
							onLoadedMetadata={(event) => {
								event.currentTarget.playbackRate = 1;
								event.currentTarget.defaultPlaybackRate = 1;
							}}
							onRateChange={(event) => {
								if (isFirstTimeVideoGate && event.currentTarget.playbackRate !== 1) {
									event.currentTarget.playbackRate = 1;
								}
							}}
							onError={() => {
								setLoadError(
									"Could not play this video. Check the uploaded file format and try again.",
								);
							}}
							src={materialUrl}
						/>
						{isFirstTimeVideoGate && (
							<div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/75 px-4 py-3 text-white">
								<div className="flex min-w-0 items-center gap-2 text-xs font-medium">
									<Lock className="h-4 w-4 shrink-0" />
									<span className="truncate">First viewing locked at normal speed</span>
								</div>
								<div className="flex items-center gap-3">
									<Button
										type="button"
										variant="ghost"
										className="h-9 w-9 p-0 text-white hover:bg-white/10 hover:text-white"
										onClick={toggleVideoMuted}
									>
										{videoMuted || videoVolume === 0 ? (
											<VolumeX className="h-4 w-4" />
										) : (
											<Volume2 className="h-4 w-4" />
										)}
									</Button>
									<input
										type="range"
										min="0"
										max="1"
										step="0.05"
										value={videoMuted ? 0 : videoVolume}
										aria-label="Video volume"
										className="w-28 accent-white"
										onChange={(event) =>
											updateVideoVolume(Number(event.target.value))
										}
									/>
								</div>
							</div>
						)}
						{isFirstTimeVideoGate && videoNeedsStart && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/40">
								<Button type="button" onClick={startVideo}>
									<Play className="mr-2 h-4 w-4" />
									Start Video
								</Button>
							</div>
						)}
					</div>
				) : material?.type === "IMAGE" ? (
					<div className="flex h-[74vh] items-center justify-center bg-slate-950 p-4">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							key={`${material.id}-${previewVersion}`}
							src={materialUrl}
							alt={material.title}
							className="max-h-full max-w-full object-contain"
							onContextMenu={(event) => event.preventDefault()}
						/>
					</div>
				) : material?.type === "RICH_TEXT" ||
				  (material && isRichTextMaterialContent(materialUrl)) ? (
					<div className="h-[74vh] overflow-y-auto bg-white px-6 py-5">
						{/* FIXED: Removed Tailwind prose and applied ql-editor to render custom colors/styles correctly */}
						<div
							className="ql-editor text-black"
							dangerouslySetInnerHTML={{ __html: richTextHtml }}
						/>
					</div>
				) : material ? (
					<div className="grid h-[74vh] grid-rows-[1fr_auto] bg-slate-950">
						<iframe
							key={`${pdfUrl}-${previewVersion}`}
							title={material.title}
							src={pdfUrl}
							className="h-full w-full bg-white"
						/>
						<div className="flex items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 p-3">
							<Button
								variant="outline"
								onClick={() => setPage((value) => Math.max(1, value - 1))}
								disabled={page === 1 || hideControls}
							>
								<ChevronLeft className="mr-2 h-4 w-4" />
								Previous
							</Button>
							<span className="text-sm font-medium text-white">
								Page {page}
								{hideControls ? " · Navigation locked" : ""}
							</span>
							<Button
								variant="outline"
								onClick={() => setPage((value) => value + 1)}
								disabled={hideControls}
							>
								Next
								<ChevronRight className="ml-2 h-4 w-4" />
							</Button>
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
