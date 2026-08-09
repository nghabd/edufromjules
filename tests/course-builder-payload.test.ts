import { describe, expect, it } from "vitest";
import { normalizeCourseBuilderPayload } from "../lib/course-payload-write";
import { sanitizeHTML } from "../lib/input-sanitization";

describe("course builder payload handling", () => {
	it("preserves safe rich-text editor styles and classes", () => {
		const html =
			'<p class="ql-align-center"><span style="color: rgb(230, 0, 0); background-color: rgb(255, 255, 0);">Important</span></p>';

		expect(sanitizeHTML(html)).toContain('class="ql-align-center"');
		expect(sanitizeHTML(html)).toContain("color:");
		expect(sanitizeHTML(html)).toContain("background-color:");
	});

	it("removes empty upload placeholders without removing article-only lessons", () => {
		const normalized = normalizeCourseBuilderPayload({
			title: "Soft skills",
			description: "",
			category: "Soft Skills",
			topics: [
				{
					title: "Communication",
					description: "",
					materials: [
						{
							title: "Lesson Article",
							type: "RICH_TEXT",
							url: "",
							content: "<p>Article only</p>",
						},
						{
							title: "",
							type: "PDF",
							url: "",
							content: "",
						},
					],
					quiz: null,
				},
			],
		}) as { topics: Array<{ materials: Array<{ type: string }> }> };

		expect(normalized.topics[0].materials).toHaveLength(1);
		expect(normalized.topics[0].materials[0].type).toBe("RICH_TEXT");
	});
});
