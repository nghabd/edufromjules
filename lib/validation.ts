/**
 * Input Validation Utilities
 * Provides secure input validation and sanitization
 */

export class ValidationError extends Error {
	constructor(
		public field: string,
		message: string,
	) {
		super(message);
		this.name = "ValidationError";
	}
}

// Email validation
const STRONG_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): string {
	const trimmed = String(email).trim().toLowerCase();
	if (!STRONG_EMAIL_REGEX.test(trimmed)) {
		throw new ValidationError("email", "Invalid email format");
	}
	if (trimmed.length > 255) {
		throw new ValidationError("email", "Email is too long");
	}
	return trimmed;
}

// Password validation - enforce strong passwords
export function validatePassword(password: string): string {
	const str = String(password);
	if (str.length < 8) {
		throw new ValidationError(
			"password",
			"Password must be at least 8 characters",
		);
	}
	if (str.length > 128) {
		throw new ValidationError("password", "Password is too long");
	}
	if (!/[A-Z]/.test(str)) {
		throw new ValidationError(
			"password",
			"Password must contain at least one uppercase letter",
		);
	}
	if (!/[a-z]/.test(str)) {
		throw new ValidationError(
			"password",
			"Password must contain at least one lowercase letter",
		);
	}
	if (!/[0-9]/.test(str)) {
		throw new ValidationError(
			"password",
			"Password must contain at least one number",
		);
	}
	return str;
}

// Name validation
export function validateName(name: string): string {
	const trimmed = String(name).trim();
	if (trimmed.length < 2) {
		throw new ValidationError("name", "Name must be at least 2 characters");
	}
	if (trimmed.length > 100) {
		throw new ValidationError("name", "Name is too long");
	}
	if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
		throw new ValidationError("name", "Name contains invalid characters");
	}
	return trimmed;
}

// UUID validation
export function validateUUID(id: string): string {
	const uuid = String(id).trim();
	if (!/^[a-z0-9]{24,}$/.test(uuid)) {
		throw new ValidationError("id", "Invalid ID format");
	}
	return uuid;
}

// String with max length
export function validateString(
	value: string,
	fieldName: string,
	minLength = 1,
	maxLength = 500,
): string {
	const str = String(value).trim();
	if (str.length < minLength) {
		throw new ValidationError(
			fieldName,
			`${fieldName} must be at least ${minLength} characters`,
		);
	}
	if (str.length > maxLength) {
		throw new ValidationError(
			fieldName,
			`${fieldName} must not exceed ${maxLength} characters`,
		);
	}
	return str;
}

// Integer validation
export function validateInteger(
	value: unknown,
	fieldName: string,
	min?: number,
	max?: number,
): number {
	const num = Number(value);
	if (!Number.isInteger(num)) {
		throw new ValidationError(fieldName, `${fieldName} must be an integer`);
	}
	if (min !== undefined && num < min) {
		throw new ValidationError(
			fieldName,
			`${fieldName} must be at least ${min}`,
		);
	}
	if (max !== undefined && num > max) {
		throw new ValidationError(fieldName, `${fieldName} must not exceed ${max}`);
	}
	return num;
}

// Date validation
export function validateDate(
	value: unknown,
	fieldName: string,
	pastAllowed = true,
): Date {
	const date = new Date(String(value));
	if (isNaN(date.getTime())) {
		throw new ValidationError(fieldName, `${fieldName} is not a valid date`);
	}
	if (!pastAllowed && date < new Date()) {
		throw new ValidationError(fieldName, `${fieldName} must be in the future`);
	}
	return date;
}

// URL validation
export function validateUrl(url: string, fieldName = "url"): string {
	try {
		const parsed = new URL(url);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			throw new Error("Invalid protocol");
		}
		return url;
	} catch {
		throw new ValidationError(fieldName, "Invalid URL format");
	}
}

// File path validation (prevent directory traversal)
export function validateFilePath(filePath: string): string {
	const normalized = String(filePath).replace(/\\/g, "/");
	if (normalized.includes("..") || normalized.startsWith("/")) {
		throw new ValidationError("filePath", "Invalid file path");
	}
	return normalized;
}

// File upload validation
interface FileUploadValidation {
	valid: boolean;
	error?: string;
}

const MIME_TYPE_EXTENSIONS: Record<string, string[]> = {
	"application/pdf": [".pdf"],
	"video/mp4": [".mp4"],
	"image/jpeg": [".jpg", ".jpeg"],
	"image/png": [".png"],
	"image/webp": [".webp"],
	"application/msword": [".doc"],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
		".docx",
	],
	"application/vnd.ms-powerpoint": [".ppt"],
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": [
		".pptx",
	],
};

const TYPE_TO_MIME_TYPES: Record<string, string[]> = {
	PDF: ["application/pdf"],
	VIDEO: ["video/mp4", "video/quicktime", "video/x-msvideo"],
	IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
	DOCUMENT: [
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"text/plain",
	],
	PRESENTATION: [
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	],
};

const MAX_FILE_SIZES: Record<string, number> = {
	PDF: 50 * 1024 * 1024, // 50MB
	VIDEO: 500 * 1024 * 1024, // 500MB
	IMAGE: 20 * 1024 * 1024, // 20MB
	DOCUMENT: 10 * 1024 * 1024, // 10MB
	PRESENTATION: 50 * 1024 * 1024, // 50MB
};

export function validateFileUpload(
	file: File,
	materialType: string,
): FileUploadValidation {
	// Check file name
	if (!file.name || file.name.length === 0) {
		return { valid: false, error: "File name is required" };
	}

	if (file.name.length > 255) {
		return {
			valid: false,
			error: "File name is too long (max 255 characters)",
		};
	}

	// Check for malicious file names
	if (
		file.name.includes("..") ||
		file.name.includes("/") ||
		file.name.includes("\\")
	) {
		return { valid: false, error: "Invalid file name" };
	}

	// Get allowed MIME types for this material type
	const allowedMimes = TYPE_TO_MIME_TYPES[materialType];
	if (!allowedMimes) {
		return { valid: false, error: "Invalid material type" };
	}

	// Check MIME type
	if (!allowedMimes.includes(file.type)) {
		return {
			valid: false,
			error: `Invalid file type. Expected: ${allowedMimes.join(", ")}`,
		};
	}

	// Check file size
	const maxSize = MAX_FILE_SIZES[materialType];
	if (file.size > maxSize) {
		return {
			valid: false,
			error: `File is too large. Maximum: ${Math.round(maxSize / 1024 / 1024)}MB`,
		};
	}

	// Check minimum file size
	if (file.size <= 0) {
		return { valid: false, error: "File is empty" };
	}

	return { valid: true };
}

export function validateFileExtension(
	filename: string,
	allowedMimes: string[],
): boolean {
	const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));

	for (const mime of allowedMimes) {
		const extensions = MIME_TYPE_EXTENSIONS[mime] || [];
		if (extensions.includes(ext)) {
			return true;
		}
	}

	return false;
}

// Role validation
export function validateRole(
	role: string,
): "ADMIN" | "SUPERVISOR" | "PHARMACIST" {
	const validRoles = ["ADMIN", "SUPERVISOR", "PHARMACIST"] as const;
	if (!validRoles.includes(role as (typeof validRoles)[number])) {
		throw new ValidationError("role", "Invalid role");
	}
	return role as "ADMIN" | "SUPERVISOR" | "PHARMACIST";
}

// Sanitize object by validating and trimming all string fields
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
	const result: Record<string, unknown> = { ...obj };
	for (const key in result) {
		if (typeof result[key] === "string") {
			result[key] = String(result[key]).trim();
		}
	}
	return result as T;
}

// Validate request body structure
export function validateRequestBody(
	body: unknown,
	required: string[],
): Record<string, unknown> {
	if (!body || typeof body !== "object") {
		throw new ValidationError("body", "Invalid request body");
	}
	const payload = body as Record<string, unknown>;

	const missing: string[] = [];
	for (const field of required) {
		if (
			!(field in payload) ||
			payload[field] === null ||
			payload[field] === undefined
		) {
			missing.push(field);
		}
	}

	if (missing.length > 0) {
		throw new ValidationError(
			"body",
			`Missing required fields: ${missing.join(", ")}`,
		);
	}

	return payload;
}
