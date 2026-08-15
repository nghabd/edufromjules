"use client";

import { useCallback, useMemo, useState } from "react";
import { Document, Page } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/lib/pdf-worker";

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

export function PdfViewer({
	url,
	page,
	onPageChange,
	disabled = false,
	className,
}: {
	url: string;
	page: number;
	onPageChange: (page: number) => void;
	disabled?: boolean;
	className?: string;
}) {
	const [numPages, setNumPages] = useState<number | null>(null);
	const pdfUrl = useMemo(() => toInlinePdfUrl(url), [url]);

	const goTo = useCallback(
		(next: number) => {
			if (!numPages) return;
			onPageChange(Math.min(Math.max(1, next), numPages));
		},
		[numPages, onPageChange],
	);

	return (
		<div className={cn("grid h-full grid-rows-[1fr_auto]", className)}>
			<div className="min-h-0 overflow-auto bg-slate-950 p-3">
				<Document
					file={pdfUrl}
					onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
					onLoadError={() => setNumPages(null)}
					loading={
						<div className="flex h-full min-h-40 items-center justify-center text-slate-400">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Loading PDF…
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
			<div className="flex items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 p-3">
				<Button
					variant="outline"
					onClick={() => goTo(page - 1)}
					disabled={disabled || page <= 1 || numPages === null}
				>
					<ChevronLeft className="mr-2 h-4 w-4" />
					Previous
				</Button>
				<span className="text-sm font-medium text-white">
					Page {numPages ? page : "-"} of {numPages ?? "-"}
					{disabled ? " · Navigation locked" : ""}
				</span>
				<Button
					variant="outline"
					onClick={() => goTo(page + 1)}
					disabled={disabled || (numPages !== null && page >= numPages)}
				>
					Next
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}