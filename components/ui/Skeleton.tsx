"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("animate-pulse rounded bg-slate-200 dark:bg-slate-700", className)}
			{...props}
		/>
	);
}

export function SkeletonText({ lines = 3, className, ...props }: { lines?: number } & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("space-y-2", className)} {...props}>
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton key={i} className="h-4 w-full" />
			))}
		</div>
	);
}

export function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("rounded-2xl border border-border bg-card p-4 space-y-4", className)} {...props}>
			<Skeleton className="h-6 w-1/3" />
			<SkeletonText lines={3} />
			<Skeleton className="h-2 w-1/2" />
		</div>
	);
}

export function SkeletonList({ items = 5, className, ...props }: { items?: number } & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("space-y-3", className)} {...props}>
			{Array.from({ length: items }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<Skeleton className="h-10 w-10 rounded-full" />
					<div className="flex-1 space-y-1">
						<Skeleton className="h-4 w-1/3" />
						<Skeleton className="h-3 w-1/4" />
					</div>
				</div>
			))}
		</div>
	);
}

export function SkeletonCourseCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3", className)} {...props}>
			<div className="flex items-center gap-2">
				<Skeleton className="h-5 w-5" />
				<Skeleton className="h-5 w-24" />
				<Skeleton className="h-4 w-16" />
			</div>
			<SkeletonText lines={2} />
			<div className="flex gap-2">
				<Skeleton className="h-6 w-20" />
				<Skeleton className="h-6 w-20" />
			</div>
			<div className="space-y-1">
				<div className="flex justify-between text-xs">
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-3 w-8" />
				</div>
				<Skeleton className="h-2 w-full rounded-full" />
			</div>
			<SkeletonText lines={3} />
		</div>
	);
}

export function SkeletonMessage({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("flex gap-3", className)} {...props}>
			<Skeleton className="h-10 w-10 rounded-full" />
			<div className="flex-1 space-y-2">
				<Skeleton className="h-4 w-1/3" />
				<Skeleton className="h-12 w-full rounded-md" />
				<Skeleton className="h-3 w-1/4" />
			</div>
		</div>
	);
}

export function Spinner({ size = "md", className, ...props }: { size?: "sm" | "md" | "lg" } & React.SVGProps<SVGSVGElement>) {
	const sizeClasses = {
		sm: "h-4 w-4",
		md: "h-6 w-6",
		lg: "h-8 w-8",
	};
	return (
		<svg
			className={cn("animate-spin text-primary", sizeClasses[size], className)}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			{...props}
		>
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	);
}

export function LoadingOverlay({ message = "Loading…" }: { message?: string }) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
			<div className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 shadow-xl border border-border">
				<Spinner size="lg" />
				<p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
			</div>
		</div>
	);
}