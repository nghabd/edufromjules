import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeFileName(filename: string): string {
	if (!filename || typeof filename !== "string") {
		return "file";
	}
	let sanitized = filename
		.replace(/\.\./g, "")
		.replace(/[\\\/]/g, "")
		.replace(/^\.+/, "");
	sanitized = sanitized.replace(/\0/g, "");
	sanitized = sanitized.replace(/[^a-zA-Z0-9._\-]/g, "_");
	if (sanitized.length > 255) {
		sanitized = sanitized.substring(0, 255);
	}
	return sanitized || "file";
}
