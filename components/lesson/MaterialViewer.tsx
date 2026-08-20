"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import axios from "axios";
import toast from "react-hot-toast";
import {
	Fullscreen,
	Loader2,
	Lock,
	Minimize2,
	MousePointer2,
	Pause,
	Play,
	RotateCw,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	X,
	Zap,
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

// Loaded client-only so react-pdf never evaluates on the server (DOMMatrix).
const PdfViewer = dynamic(
	() => import("@/components/lesson/PdfViewer").then((mod) => mod.PdfViewer),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full min-h-40 items-center justify-center text-slate-400">
				Loading PDF viewer…
			</div>
		),
	},
);

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
	const videoContainerRef = useRef<HTMLDivElement | null>(null);

	const enterFullscreen = () => {
		const container = videoContainerRef.current;
		if (!container) return Promise.resolve();
		if (container.requestFullscreen) {
			return container.requestFullscreen().catch(() => {});
		}
		return Promise.resolve();
	};
	const [engagement, setEngagement] = useState<Engagement | null>(null);
	const [materialOpenedAt, setMaterialOpenedAt] = useState<Date | null>(null);
	const [now, setNow] = useState(0);
	const [page, setPage] = useState(1);
	const [videoVolume, setVideoVolume] = useState(0.85);
	const [videoMuted, setVideoMuted] = useState(false);
	const [videoNeedsStart, setVideoNeedsStart] = useState(false);
	const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
	const [videoShowControls, setVideoShowControls] = useState(true);
	const [videoProgress, setVideoProgress] = useState(0);
	const [videoBuffered, setVideoBuffered] = useState(0);
	const [videoDuration, setVideoDuration] = useState(0);
	const [videoCurrentTime, setVideoCurrentTime] = useState(0);
	const [isVideoPlaying, setIsVideoPlaying] = useState(false);
	const [isPip, setIsPip] = useState(false);
	const [videoQuality, setVideoQuality] = useState("auto");
	const [videoLoading, setVideoLoading] = useState(false);
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
					question: response.data.material?.gateQuestion || material.gateQuestion || "",
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
			: material?.gateQuestion || "";
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

		const handlePlay = () => setIsVideoPlaying(true);
		const handlePause = () => setIsVideoPlaying(false);
		video.addEventListener("play", handlePlay);
		video.addEventListener("pause", handlePause);

		if (!isFirstTimeVideoGate) return;

		const playVideo = async () => {
			try {
				await video.play();
				setVideoNeedsStart(false);
				void enterFullscreen();
			} catch {
				try {
					video.muted = true;
					setVideoMuted(true);
					await video.play();
					setVideoNeedsStart(false);
					void enterFullscreen();
				} catch {
					setVideoNeedsStart(true);
				}
			}
		};

		void playVideo();

		return () => {
			video.removeEventListener("play", handlePlay);
			video.removeEventListener("pause", handlePause);
		};
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
			void enterFullscreen();
		} catch {
			toast.error("Could not start the video. Please try again.");
		}
	};

	const toggleVideoFullscreen = () => {
		if (document.fullscreenElement) {
			void document.exitFullscreen().catch(() => {});
			return;
		}
		void enterFullscreen();
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

	const setVideoRate = (rate: number) => {
		setVideoPlaybackRate(rate);
		const video = videoRef.current;
		if (video) video.playbackRate = rate;
	};

	const toggleVideoPip = async () => {
		const video = videoRef.current;
		if (!video) return;
		try {
			if (document.pictureInPictureElement === video) {
				await document.exitPictureInPicture();
				setIsPip(false);
			} else {
				await video.requestPictureInPicture();
				setIsPip(true);
			}
		} catch {
			toast.error("Picture-in-Picture not available");
		}
	};

	const handleVideoTimeUpdate = () => {
		const video = videoRef.current;
		if (!video) return;
		setVideoProgress((video.currentTime / video.duration) * 100 || 0);
		setVideoCurrentTime(video.currentTime);
	};

	const handleVideoLoadedMetadata = () => {
		const video = videoRef.current;
		if (!video) return;
		setVideoDuration(video.duration);
	};

	const handleVideoProgress = () => {
		const video = videoRef.current;
		if (!video || !video.buffered.length) return;
		const bufferedEnd = video.buffered.end(video.buffered.length - 1);
		setVideoBuffered((bufferedEnd / video.duration) * 100 || 0);
	};

	const handleVideoWaiting = () => setVideoLoading(true);
	const handleVideoCanPlay = () => setVideoLoading(false);

	const handleVideoKeyDown = (e: React.KeyboardEvent) => {
		const video = videoRef.current;
		if (!video) return;
		switch (e.key) {
			case " ":
			case "k":
				e.preventDefault();
				video.paused ? video.play() : video.pause();
				break;
			case "ArrowLeft":
				e.preventDefault();
				video.currentTime = Math.max(0, video.currentTime - 10);
				break;
			case "ArrowRight":
				e.preventDefault();
				video.currentTime = Math.min(video.duration, video.currentTime + 10);
				break;
			case "ArrowUp":
				e.preventDefault();
				updateVideoVolume(Math.min(1, video.volume + 0.1));
				break;
			case "ArrowDown":
				e.preventDefault();
				updateVideoVolume(Math.max(0, video.volume - 0.1));
				break;
			case "f":
				toggleVideoFullscreen();
				break;
			case "m":
				toggleVideoMuted();
				break;
			case "p":
				toggleVideoPip();
				break;
			case ">":
			case ".":
				e.shiftKey && setVideoRate(Math.min(2, video.playbackRate + 0.25));
				break;
			case "<":
			case ",":
				e.shiftKey && setVideoRate(Math.max(0.25, video.playbackRate - 0.25));
				break;
			case "0":
				setVideoRate(1);
				break;
		}
	};

	function formatTime(seconds: number) {
		if (!seconds || isNaN(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

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
			const answer = gateQuestion ? window.prompt(gateQuestion) ?? "" : "";

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
		}

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
					<div
						ref={videoContainerRef}
						className="relative h-[74vh] bg-black"
						onMouseEnter={() => setVideoShowControls(true)}
						onMouseLeave={() => setVideoShowControls(false)}
						onKeyDown={handleVideoKeyDown}
						tabIndex={0}
					>
						<video
							ref={videoRef}
							key={`${material.id}-${previewVersion}`}
							className="h-full w-full bg-black"
							autoPlay={isFirstTimeVideoGate}
							playsInline
							preload="auto"
							controls={false}
							disablePictureInPicture={false}
							onContextMenu={(event) => event.preventDefault()}
							onLoadedMetadata={handleVideoLoadedMetadata}
							onTimeUpdate={handleVideoTimeUpdate}
							onProgress={handleVideoProgress}
							onWaiting={handleVideoWaiting}
							onCanPlay={handleVideoCanPlay}
							onError={() => {
								setLoadError(
									"Could not play this video. Check the uploaded file format and try again.",
								);
							}}
							src={materialUrl}
						/>
						{videoLoading && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
								<Loader2 className="h-8 w-8 animate-spin text-white" />
							</div>
						)}

						{videoShowControls && (
							<div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto">
								<div className="flex items-center justify-between gap-4 mb-2">
									<div className="flex items-center gap-3 flex-1 min-w-0">
										{isFirstTimeVideoGate && (
											<div className="flex items-center gap-2 text-xs font-medium text-white/80">
												<Lock className="h-3.5 w-3.5 shrink-0" />
												<span className="truncate">
													First viewing locked at normal speed
												</span>
											</div>
										)}
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										<div className="relative group">
											<select
												value={videoPlaybackRate}
												onChange={(e) => setVideoRate(Number(e.target.value))}
												className="bg-black/50 text-white text-xs rounded px-2 py-1 border border-white/20 focus:outline-none focus:ring-1 focus:ring-primary"
												disabled={isFirstTimeVideoGate}
												title="Playback speed"
											>
												{[
													0.25,
													0.5,
													0.75,
													1,
													1.25,
													1.5,
													1.75,
													2,
												].map((r) => (
													<option key={r} value={r}>
														{r}x
													</option>
												))}
											</select>
										</div>
										<div className="relative group">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-9 w-9 p-0 text-white hover:bg-white/10"
												onClick={toggleVideoPip}
												disabled={isPip || !document.pictureInPictureEnabled}
												title="Picture-in-Picture (P)"
											>
												{isPip ? <Minimize2 className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
											</Button>
										</div>
									</div>
								</div>

								<div className="relative h-2 mb-2">
									<div
										className="absolute inset-0 h-full bg-white/20 rounded-full overflow-hidden"
										style={{ width: `${videoBuffered}%` }}
									/>
									<div
										className="absolute inset-0 h-full bg-primary rounded-full transition-all duration-75"
										style={{ width: `${videoProgress}%` }}
									/>
									<input
										type="range"
										min="0"
										max="100"
										value={videoProgress}
										onChange={(e) => {
											const video = videoRef.current;
											if (video) video.currentTime = (Number(e.target.value) / 100) * video.duration;
										}}
										className="absolute inset-0 h-full appearance-none bg-transparent cursor-pointer focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black"
										aria-label="Seek"
									/>
								</div>

								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-9 w-9 p-0 text-white hover:bg-white/10"
											onClick={() => {
												const video = videoRef.current;
												if (video) video.currentTime = Math.max(0, video.currentTime - 10);
											}}
											aria-label="Rewind 10s"
										>
											<SkipBack className="h-4 w-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-9 w-9 p-0 text-white hover:bg-white/10"
											onClick={() => {
												const video = videoRef.current;
												if (video) {
													if (video.paused) {
														video.play();
														setIsVideoPlaying(true);
													} else {
														video.pause();
														setIsVideoPlaying(false);
													}
												}
											}}
											aria-label="Play/Pause (Space/K)"
										>
											{isVideoPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-9 w-9 p-0 text-white hover:bg-white/10"
											onClick={() => {
												const video = videoRef.current;
												if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
											}}
											aria-label="Forward 10s"
										>
											<SkipForward className="h-4 w-4" />
										</Button>

										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-9 w-9 p-0 text-white hover:bg-white/10"
											onClick={toggleVideoMuted}
											title="Mute (M)"
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
											className="w-24 accent-white"
											onChange={(event) =>
												updateVideoVolume(Number(event.target.value))
											}
										/>
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										<span className="text-xs font-mono text-white/70 tabular-nums">
											{formatTime(videoDuration)} / {formatTime(videoCurrentTime)}
										</span>
										<button
											type="button"
											className="h-9 w-9 p-0 text-white hover:bg-white/10"
											onClick={toggleVideoFullscreen}
											aria-label="Toggle fullscreen"
											title="Fullscreen (F)"
										>
											{document.fullscreenElement ? <Minimize2 className="h-4 w-4" /> : <Fullscreen className="h-4 w-4" />}
										</button>
									</div>
								</div>
							</div>
						)}
						{isFirstTimeVideoGate && videoNeedsStart && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/40">
								<Button type="button" onClick={startVideo} size="lg" className="bg-primary hover:bg-primary/90">
									<Play className="mr-2 h-5 w-5" />
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
					<PdfViewer
						url={materialUrl}
						page={page}
						onPageChange={setPage}
						disabled={hideControls}
						className="h-[74vh]"
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
