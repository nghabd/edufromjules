/**
 * Comprehensive Input Sanitization Module
 * Handles XSS prevention, SQL injection prevention, and data validation
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * HTML sanitization with DOMPurify
 */
export function sanitizeHTML(
	html: string,
	config: Record<string, unknown> = {},
): string {
	const defaultConfig = {
		ALLOWED_TAGS: [
			"p",
			"br",
			"strong",
			"em",
			"u",
			"a",
			"ul",
			"li",
			"ol",
			"h1",
			"h2",
			"h3",
			"h4",
			"blockquote",
			"span",
			"div",
		],
		ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
		KEEP_CONTENT: true,
		...config,
	};

	return String(DOMPurify.sanitize(html, defaultConfig));
}

/**
 * Sanitize plain text to prevent XSS
 */
export function sanitizeText(text: string): string {
	if (typeof text !== "string") return "";

	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;")
		.replace(/\//g, "&#x2F;");
}

/**
 * Sanitize JSON-serializable object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
	obj: T,
	maxDepth: number = 10,
): T {
	if (maxDepth <= 0) return obj;

	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		// Sanitize key
		const sanitizedKey = sanitizeText(String(key));

		if (value === null || value === undefined) {
			result[sanitizedKey] = value;
		} else if (typeof value === "string") {
			result[sanitizedKey] = sanitizeText(value);
		} else if (typeof value === "object") {
			if (Array.isArray(value)) {
				result[sanitizedKey] = value.map((item) =>
					typeof item === "string" ? sanitizeText(item) : item,
				);
			} else {
				result[sanitizedKey] = sanitizeObject(
					value as Record<string, unknown>,
					maxDepth - 1,
				);
			}
		} else if (typeof value === "number" || typeof value === "boolean") {
			result[sanitizedKey] = value;
		}
	}

	return result as T;
}

/**
 * Sanitize URL to prevent javascript: protocol and other attacks
 */
export function sanitizeURL(url: string): string {
	try {
		const parsed = new URL(url);
		if (!["http:", "https:", "ftp:"].includes(parsed.protocol)) {
			return "";
		}
		return url;
	} catch {
		// If URL parsing fails, it's invalid
		return "";
	}
}

/**
 * Remove SQL injection patterns
 */
export function sanitizeSQL(input: string): string {
	// This is a basic check - always use parameterized queries in production!
	const sqlPatterns = /('|(--)|;|\/\*|\*\/|xp_|sp_|exec|execute)/gi;
	return input.replace(sqlPatterns, "");
}

/**
 * Sanitize file name to prevent directory traversal
 */
export function sanitizeFileName(filename: string): string {
	if (!filename || typeof filename !== "string") {
		return "file";
	}

	// Remove directory traversal attempts
	let sanitized = filename
		.replace(/\.\./g, "")
		.replace(/[\/\\]/g, "")
		.replace(/^\.+/, "");

	// Remove null bytes
	sanitized = sanitized.replace(/\0/g, "");

	// Keep only safe characters
	sanitized = sanitized.replace(/[^a-zA-Z0-9._\-]/g, "_");

	// Limit length
	if (sanitized.length > 255) {
		sanitized = sanitized.substring(0, 255);
	}

	return sanitized || "file";
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
	const trimmed = String(email).trim().toLowerCase();
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

	if (!emailRegex.test(trimmed)) {
		throw new Error("Invalid email format");
	}

	return trimmed;
}

/**
 * Sanitize UUID/ID
 */
export function sanitizeID(id: string): string {
	const sanitized = String(id)
		.replace(/[^a-z0-9\-]/gi, "")
		.trim();
	if (sanitized.length === 0) {
		throw new Error("Invalid ID format");
	}
	return sanitized;
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(
	query: string,
	maxLength: number = 256,
): string {
	// Remove special search characters that could cause issues
	let sanitized = String(query).trim();

	// Limit length
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	// Remove control characters
	sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

	return sanitized;
}

/**
 * Sanitize JSON string
 */
export function sanitizeJSON(jsonString: string): string {
	try {
		const parsed = JSON.parse(jsonString);
		// Re-serialize to remove any suspicious content
		return JSON.stringify(parsed);
	} catch {
		throw new Error("Invalid JSON");
	}
}

/**
 * Sanitize object for database storage
 */
export function sanitizeForDatabase<T>(obj: T): T {
	if (typeof obj === "string") {
		return sanitizeText(obj) as T;
	}

	if (typeof obj !== "object" || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeForDatabase(item)) as T;
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj as object)) {
		result[key] = sanitizeForDatabase(value);
	}

	return result as T;
}

/**
 * Check for suspicious patterns in input
 */
export function detectSuspiciousPatterns(input: string): boolean {
	const suspiciousPatterns = [
		/<script[^>]*>.*?<\/script>/gi, // Script tags
		/javascript:/gi, // Javascript protocol
		/on\w+\s*=/gi, // Event handlers
		/union\s+select/gi, // SQL injection
		/drop\s+table/gi, // SQL injection
		/insert\s+into/gi, // SQL injection
		/delete\s+from/gi, // SQL injection
		/\.\.\/\.\.\//g, // Directory traversal
		/\0/g, // Null bytes
	];

	return suspiciousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Sanitize input based on type
 */
export function sanitizeByType(
	value: unknown,
	type: "string" | "email" | "url" | "number" | "boolean" | "json" | "html",
): unknown {
	switch (type) {
		case "string":
			return sanitizeText(String(value));
		case "email":
			return sanitizeEmail(String(value));
		case "url":
			return sanitizeURL(String(value));
		case "number":
			return Number(value);
		case "boolean":
			return Boolean(value);
		case "json":
			return sanitizeJSON(String(value));
		case "html":
			return sanitizeHTML(String(value));
		default:
			return value;
	}
}

/**
 * Comprehensive input validation and sanitization pipeline
 */
export function validateAndSanitize<T extends Record<string, unknown>>(
	input: T,
	schema: Record<
		keyof T,
		{
			type: "string" | "number" | "boolean" | "email" | "url" | "json" | "html";
			required?: boolean;
			minLength?: number;
			maxLength?: number;
			pattern?: RegExp;
		}
	>,
): T {
	const result: Record<string, unknown> = {};

	for (const [key, config] of Object.entries(schema)) {
		const value = input[key as keyof T];

		// Check required
		if (
			config.required &&
			(value === null || value === undefined || value === "")
		) {
			throw new Error(`${key} is required`);
		}

		if (value === null || value === undefined) {
			result[key] = undefined;
			continue;
		}

		// Type conversion and sanitization
		const sanitized = sanitizeByType(value, config.type);

		// String validations
		if (
			config.type === "string" ||
			config.type === "email" ||
			config.type === "url" ||
			config.type === "html"
		) {
			const str = String(sanitized);

			if (config.minLength && str.length < config.minLength) {
				throw new Error(
					`${key} must be at least ${config.minLength} characters`,
				);
			}

			if (config.maxLength && str.length > config.maxLength) {
				throw new Error(
					`${key} must not exceed ${config.maxLength} characters`,
				);
			}

			if (config.pattern && !config.pattern.test(str)) {
				throw new Error(`${key} format is invalid`);
			}
		}

		result[key] = sanitized;
	}

	return result as T;
}
