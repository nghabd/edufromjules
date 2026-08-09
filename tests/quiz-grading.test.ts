import { describe, expect, it } from "vitest";
import {
	normalizeAnswer,
	parseStoredCorrectAnswer,
	sameAnswers,
} from "../lib/quiz-grading";

describe("quiz grading helpers", () => {
	it("grades raw string and JSON serialized string answers the same way", () => {
		const rawExpected = normalizeAnswer(parseStoredCorrectAnswer("A"), "RADIO");
		const jsonExpected = normalizeAnswer(
			parseStoredCorrectAnswer('"A"'),
			"RADIO",
		);
		const actual = normalizeAnswer("A", "RADIO");

		expect(sameAnswers(actual, rawExpected)).toBe(true);
		expect(sameAnswers(actual, jsonExpected)).toBe(true);
	});

	it("grades JSON serialized answer arrays", () => {
		const expected = normalizeAnswer(
			parseStoredCorrectAnswer('["A","C"]'),
			"MULTI_SELECT",
		);
		const actual = normalizeAnswer(["C", "A"], "MULTI_SELECT");

		expect(sameAnswers(actual, expected)).toBe(true);
	});
});
