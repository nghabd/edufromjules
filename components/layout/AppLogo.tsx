"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type AppLogoProps = {
	className?: string;
};

export function AppLogo({ className }: AppLogoProps) {
	return (
		<span
			className={cn(
				"edustation-live-logo relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem]",
				className,
			)}
		>
			<Image
				src="/brand/edustation-gemini-logo.gif"
				alt="edustation logo"
				width={256}
				height={256}
				unoptimized
				className="h-full w-full object-contain"
			/>
			<span className="edustation-live-logo-glow" aria-hidden="true" />
		</span>
	);
}
