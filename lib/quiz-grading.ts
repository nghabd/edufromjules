export function normalizeFreeText(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseStoredCorrectAnswer(value: string): unknown {
	const trimmed = value.trim();
	if (!trimmed) return "";

	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return trimmed;
	}
}

export function normalizeAnswer(value: unknown, type: string) {
	const asArray = Array.isArray(value)
		? value.map(String)
		: typeof value === "string"
			? [value]
			: [];

	const cleaned = asArray.map((item) => item.trim()).filter(Boolean);

	if (type === "COMPLETE") {
		return cleaned.map(normalizeFreeText);
	}

	if (type === "TRUE_FALSE") {
		return cleaned
			.map((item) => item.toLowerCase())
			.filter((item) => item === "true" || item === "false")
			.map((item) => (item === "true" ? "True" : "False"));
	}

	return [...new Set(cleaned)].sort();
}

export function sameAnswers(a: string[], b: string[]) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}
