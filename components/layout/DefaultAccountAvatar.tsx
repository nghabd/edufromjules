"use client";

import { cn } from "@/lib/utils";

type DefaultAccountAvatarProps = {
	label?: string | null;
	image?: string | null;
	className?: string;
};

export function DefaultAccountAvatar({
	label,
	image,
	className,
}: DefaultAccountAvatarProps) {
	const initial = (label?.trim()?.[0] || "E").toUpperCase();

	if (image) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={image}
				alt="Account avatar"
				className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
			/>
		);
	}

	return (
		<svg
			viewBox="0 0 48 48"
			role="img"
			aria-label="Account avatar"
			className={cn("h-9 w-9 shrink-0 rounded-full", className)}
		>
			<rect width="48" height="48" rx="24" fill="#2563eb" />
			<circle cx="24" cy="18" r="8" fill="#dbeafe" />
			<path
				d="M10 40c2.6-8 8-12 14-12s11.4 4 14 12"
				fill="#bfdbfe"
			/>
			<text
				x="24"
				y="30"
				textAnchor="middle"
				fontSize="14"
				fontWeight="700"
				fill="#1e3a8a"
				fontFamily="Arial, sans-serif"
			>
				{initial}
			</text>
		</svg>
	);
}
