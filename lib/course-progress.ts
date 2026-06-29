export type LessonProgressInput = {
	materials: Array<{ id: string }>;
	requiredQuiz?: { id: string; passingScore: number } | null;
};

type CourseQuizProgressInput = { id: string; passingScore: number } | null;

export function isLessonCompleted(
	lesson: LessonProgressInput,
	completedMaterialIds: ReadonlySet<string>,
	bestScoreByQuiz: ReadonlyMap<string, number>,
) {
	const materialsCompleted =
		lesson.materials.length === 0 ||
		lesson.materials.every((material) => completedMaterialIds.has(material.id));

	if (!materialsCompleted) return false;
	if (!lesson.requiredQuiz) return true;

	return (
		(bestScoreByQuiz.get(lesson.requiredQuiz.id) ?? 0) >=
		lesson.requiredQuiz.passingScore
	);
}

export function calculateLessonBasedCourseProgress(
	lessons: LessonProgressInput[],
	completedMaterialIds: ReadonlySet<string>,
	bestScoreByQuiz: ReadonlyMap<string, number>,
) {
	const totalLessons = lessons.length;
	const completedLessons = lessons.filter((lesson) =>
		isLessonCompleted(lesson, completedMaterialIds, bestScoreByQuiz),
	).length;

	return {
		totalLessons,
		completedLessons,
		percent:
			totalLessons === 0
				? 0
				: Math.round((completedLessons / totalLessons) * 100),
	};
}

export function calculatePartBasedCourseProgress(
	lessons: LessonProgressInput[],
	completedMaterialIds: ReadonlySet<string>,
	bestScoreByQuiz: ReadonlyMap<string, number>,
	courseQuiz: CourseQuizProgressInput = null,
) {
	let totalParts = 0;
	let completedParts = 0;

	lessons.forEach((lesson) => {
		const lessonContentParts =
			lesson.materials.length + (lesson.requiredQuiz ? 1 : 0);

		if (lessonContentParts === 0) {
			totalParts += 1;
			if (isLessonCompleted(lesson, completedMaterialIds, bestScoreByQuiz)) {
				completedParts += 1;
			}
			return;
		}

		totalParts += lesson.materials.length;
		completedParts += lesson.materials.filter((material) =>
			completedMaterialIds.has(material.id),
		).length;

		if (lesson.requiredQuiz) {
			totalParts += 1;
			if (
				(bestScoreByQuiz.get(lesson.requiredQuiz.id) ?? 0) >=
				lesson.requiredQuiz.passingScore
			) {
				completedParts += 1;
			}
		}
	});

	if (courseQuiz) {
		totalParts += 1;
		if ((bestScoreByQuiz.get(courseQuiz.id) ?? 0) >= courseQuiz.passingScore) {
			completedParts += 1;
		}
	}

	return {
		totalParts,
		completedParts,
		percent:
			totalParts === 0 ? 0 : Math.round((completedParts / totalParts) * 100),
	};
}

export function calculateCourseCompletionStatus(
	lessonProgress: { percent: number },
	courseQuiz: CourseQuizProgressInput,
	bestScoreByQuiz: ReadonlyMap<string, number>,
	progressPercent = lessonProgress.percent,
) {
	const courseQuizPassed =
		!courseQuiz ||
		(bestScoreByQuiz.get(courseQuiz.id) ?? 0) >= courseQuiz.passingScore;
	const completed = lessonProgress.percent === 100 && courseQuizPassed;

	return {
		completed,
		courseQuizPassed,
		displayPercent: completed ? 100 : Math.min(progressPercent, 99),
	};
}
