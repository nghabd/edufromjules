const RICH_TEXT_PREFIX = "richtext://";

export function encodeRichTextMaterialContent(value: string) {
	return `${RICH_TEXT_PREFIX}${encodeURIComponent(value)}`;
}

export function isRichTextMaterialContent(value: string) {
	return value.startsWith(RICH_TEXT_PREFIX);
}

export function decodeRichTextMaterialContent(value: string) {
	if (!isRichTextMaterialContent(value)) return "";
	try {
		return decodeURIComponent(value.slice(RICH_TEXT_PREFIX.length));
	} catch {
		return "";
	}
}
