"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	ZoomIn,
	ZoomOut,
	RotateCw,
	Maximize2,
	Minimize2,
	Download,
	FileText,
	LayoutDashboard,
	X,
	Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/lib/pdf-worker";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

function isOwnProxyUrl(url: string) {
	return url.startsWith("/api/materials/");
}

function toInlinePdfUrl(url: string) {
	if (!isOwnProxyUrl(url)) return url;
	const [base, query = ""] = url.split("?");
	const params = new URLSearchParams(query);
	params.set("inline", "1");
	return `${base}?${params.toString()}`;
}

interface PdfViewerProps {
	url: string;
	page: number;
	onPageChange: (page: number) => void;
	disabled?: boolean;
	className?: string;
}

export function PdfViewer({
	url,
	page,
	onPageChange,
	disabled = false,
	className,
}: PdfViewerProps) {
	const [numPages, setNumPages] = useState<number | null>(null);
	const [scale, setScale] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showThumbnails, setShowThumbnails] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const pdfUrl = useMemo(() => toInlinePdfUrl(url), [url]);
	const containerRef = useRef<HTMLDivElement>(null);
	const pdfRef = useRef<HTMLDivElement>(null);

	const goTo = useCallback(
		(next: number) => {
			if (!numPages) return;
			onPageChange(Math.min(Math.max(1, next), numPages));
		},
		[numPages, onPageChange],
	);

	const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 3)), []);
	const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.25, 0.5)), []);
	const zoomReset = useCallback(() => setScale(1), []);

	const rotate = useCallback(() => setRotation((r) => (r + 90) % 360), []);

	const toggleFullscreen = useCallback(() => {
		if (!containerRef.current) return;
		if (!isFullscreen) {
			containerRef.current.requestFullscreen().catch(() => {});
		} else {
			document.exitFullscreen().catch(() => {});
		}
	}, [isFullscreen]);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					goTo(page - 1);
					break;
				case "ArrowRight":
					e.preventDefault();
					goTo(page + 1);
					break;
				case "+":
				case "=":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						zoomIn();
					}
					break;
				case "-":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						zoomOut();
					}
					break;
				case "0":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						zoomReset();
					}
					break;
				case "r":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						rotate();
					}
					break;
				case "f":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						toggleFullscreen();
					}
					break;
				case "Escape":
					if (isFullscreen) {
						toggleFullscreen();
					}
					break;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [page, goTo, zoomIn, zoomOut, zoomReset, rotate, toggleFullscreen, isFullscreen]);

	const handleLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
		setNumPages(pages);
		setIsLoading(false);
		setError(null);
	}, []);

	const handleLoadError = useCallback(() => {
		setNumPages(null);
		setIsLoading(false);
		setError("Could not load this PDF. The file may be corrupted or inaccessible.");
	}, []);

	if (error) {
		return (
			<div className={cn("flex h-full flex-col items-center justify-center gap-4 bg-slate-950 rounded-xl border border-red-900/50 p-8", className)}>
				<FileText className="h-16 w-16 text-red-500/50" />
				<p className="text-center text-red-400 font-medium">{error}</p>
				<Button variant="outline" onClick={() => window.open(url, "_blank")}>
					Open in new tab
				</Button>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden transition-all duration-300",
				isFullscreen && "fixed inset-0 z-50 rounded-none border-none",
				className,
			)}
			style={{ height: isFullscreen ? "100vh" : "100%" }}
		>
			{isFullscreen && (
				<div className="absolute top-3 right-3 z-10 flex gap-2">
					<Tooltip content="Exit fullscreen (Esc)">
						<Button
							variant="ghost"
							size="sm"
							onClick={toggleFullscreen}
							className="bg-slate-900/80 backdrop-blur-sm"
						>
							<Minimize2 className="h-5 w-5" />
						</Button>
					</Tooltip>
				</div>
			)}

			<div className={cn("flex h-full flex-col", showThumbnails && "flex-row")}>
				{showThumbnails && numPages && (
					<aside className="w-48 border-r border-slate-800 bg-slate-900/50 overflow-y-auto p-2 flex-shrink-0">
						<div className="flex items-center justify-between mb-2 px-2">
							<h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Thumbnails</h4>
							<Button variant="ghost" size="sm" onClick={() => setShowThumbnails(false)} className="h-6 w-6">
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
						<div className="space-y-2">
							{Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
								<button
									key={p}
									onClick={() => goTo(p)}
									disabled={disabled}
									className={cn(
										"relative w-full aspect-[3/4] rounded border-2 transition-all",
										p === page
											? "border-primary ring-2 ring-primary/50"
											: "border-slate-700 hover:border-slate-500",
									)}
								>
									<Page
										pageNumber={p}
										width={100}
										renderTextLayer={false}
										renderAnnotationLayer={false}
									/>
								</button>
							))}
						</div>
					</aside>
				)}

				<div className="flex-1 flex flex-col min-w-0 relative">
					<div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-2 px-2 pt-2 pointer-events-none">
						<div className="flex items-center gap-1 pointer-events-auto">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowThumbnails(!showThumbnails)}
								className="bg-slate-900/80 backdrop-blur-sm"
								disabled={disabled || !numPages}
							>
								<LayoutDashboard className="h-4 w-4" />
							</Button>
							<Tooltip content="Download PDF">
								<a
									href={url}
									download
									target="_blank"
									rel="noopener noreferrer"
								>
									<Button variant="ghost" size="sm" className="bg-slate-900/80 backdrop-blur-sm">
										<Download className="h-4 w-4" />
									</Button>
								</a>
							</Tooltip>
						</div>
						<div className="flex-1" />
						<div className="flex items-center gap-1 pointer-events-auto">
							<Tooltip content="Zoom out (Ctrl/Cmd -)">
								<Button
									variant="ghost"
									size="sm"
									onClick={zoomOut}
									disabled={disabled || scale <= 0.5}
									className="bg-slate-900/80 backdrop-blur-sm"
								>
									<ZoomOut className="h-4 w-4" />
								</Button>
							</Tooltip>
							<span className="px-2 text-xs font-mono text-slate-300 bg-slate-900/80 backdrop-blur-sm rounded px-2 py-0.5">
								{Math.round(scale * 100)}%
							</span>
							<Tooltip content="Zoom in (Ctrl/Cmd +)">
								<Button
									variant="ghost"
									size="sm"
									onClick={zoomIn}
									disabled={disabled || scale >= 3}
									className="bg-slate-900/80 backdrop-blur-sm"
								>
									<ZoomIn className="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Reset zoom (Ctrl/Cmd 0)">
								<Button
									variant="ghost"
									size="sm"
									onClick={zoomReset}
									disabled={disabled || scale === 1}
									className="bg-slate-900/80 backdrop-blur-sm"
								>
									<RotateCw className="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Rotate (Ctrl/Cmd R)">
								<Button
									variant="ghost"
									size="sm"
									onClick={rotate}
									disabled={disabled}
									className="bg-slate-900/80 backdrop-blur-sm"
								>
									<RotateCw className="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Fullscreen (Ctrl/Cmd F)">
								<Button
									variant="ghost"
									size="sm"
									onClick={toggleFullscreen}
									disabled={disabled}
									className="bg-slate-900/80 backdrop-blur-sm"
								>
									{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
								</Button>
							</Tooltip>
						</div>
					</div>

					<div
						ref={pdfRef}
						className="flex-1 flex items-center justify-center overflow-auto p-4"
						style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, transformOrigin: "center center" }}
					>
						{isLoading && (
							<div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 z-10">
								<div className="flex flex-col items-center gap-3">
									<Loader2 className="h-8 w-8 animate-spin text-primary" />
									<p className="text-slate-400">Loading PDF…</p>
								</div>
							</div>
						)}

						<Document
							file={pdfUrl}
							onLoadSuccess={handleLoadSuccess}
							onLoadError={handleLoadError}
							loading={
								<div className="flex h-full min-h-40 items-center justify-center text-slate-400">
									<Loader2 className="h-8 w-8 animate-spin" />
								</div>
							}
							error={
								<div className="flex h-full min-h-40 items-center justify-center text-slate-400">
									Could not load this PDF.
								</div>
							}
						>
							<div className="flex justify-center">
								<Page
									pageNumber={page}
									width={Math.min(900, typeof window !== "undefined" ? window.innerWidth - 96 : 900)}
									renderTextLayer={false}
									renderAnnotationLayer={false}
								/>
							</div>
						</Document>
					</div>

					<div className="flex items-center justify-center gap-3 border-t border-slate-800 bg-slate-950/50 p-3 pointer-events-auto">
						<Button
							variant="outline"
							size="sm"
							onClick={() => goTo(page - 1)}
							disabled={disabled || page <= 1 || numPages === null}
						>
							<ChevronLeft className="mr-1.5 h-4 w-4" />
							Prev
						</Button>
						<div className="flex items-center gap-2">
							<input
								type="number"
								min={1}
								max={numPages ?? 1}
								value={page}
								onChange={(e) => {
									const val = parseInt(e.target.value, 10);
									if (!isNaN(val) && numPages) goTo(Math.min(Math.max(1, val), numPages));
								}}
								className="w-16 text-center bg-slate-800 border-slate-700 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-primary"
								disabled={disabled || !numPages}
							/>
							<span className="text-sm font-medium text-slate-300">
								of {numPages ?? "—"}
							</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => goTo(page + 1)}
							disabled={disabled || (numPages !== null && page >= numPages)}
						>
							Next
							<ChevronRight className="ml-1.5 h-4 w-4" />
						</Button>
						{disabled && (
							<span className="ml-3 text-xs text-slate-500">Navigation locked</span>
						)}
					</div>
				</div>
			</div>

			{!isFullscreen && (
				<div className="absolute bottom-2 right-2 flex gap-1 pointer-events-none">
					<Tooltip content="Keyboard shortcuts">
						<Button variant="ghost" size="sm" className="bg-slate-900/60 backdrop-blur-sm pointer-events-auto">
							<Keyboard className="h-4 w-4 text-slate-500" />
						</Button>
					</Tooltip>
				</div>
			)}
		</div>
	);
}

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
			{children}
			{visible && (
				<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in zoom-in-95">
					{content}
				</div>
			)}
		</div>
	);
}