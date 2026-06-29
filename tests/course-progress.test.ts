import { describe, expect, it } from "vitest";
import { calculateLessonBasedCourseProgress } from "../lib/course-progress";

describe("calculateLessonBasedCourseProgress", () => {
	it("drops a fully completed one-lesson course to 50% when a second lesson is added", () => {
		const progress = calculateLessonBasedCourseProgress(
			[
				{ materials: [{ id: "m1" }], requiredQuiz: null },
				{ materials: [{ id: "m2" }], requiredQuiz: null },
			],
			new Set(["m1"]),
			new Map(),
		);

		expect(progress).toEqual({
			totalLessons: 2,
			completedLessons: 1,
			percent: 50,
		});
	});

	it("returns to 100% when only the completed lesson remains", () => {
		const progress = calculateLessonBasedCourseProgress(
			[{ materials: [{ id: "m1" }], requiredQuiz: null }],
			new Set(["m1"]),
			new Map(),
		);

		expect(progress.percent).toBe(100);
	});

	it("requires the lesson quiz passing score when a quiz exists", () => {
		const lessons = [
			{
				materials: [{ id: "m1" }],
				requiredQuiz: { id: "q1", passingScore: 70 },
			},
		];

		expect(
			calculateLessonBasedCourseProgress(
				lessons,
				new Set(["m1"]),
				new Map([["q1", 69]]),
			).percent,
		).toBe(0);

		expect(
			calculateLessonBasedCourseProgress(
				lessons,
				new Set(["m1"]),
				new Map([["q1", 70]]),
			).percent,
		).toBe(100);
	});
});
