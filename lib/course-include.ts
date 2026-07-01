export const courseResponseInclude = {
	topics: {
		orderBy: { order: "asc" as const },
		include: {
			materials: { orderBy: { order: "asc" as const } },
			requiredQuiz: {
				include: { questions: { orderBy: { order: "asc" as const } } },
			},
		},
	},
	quizzes: {
		where: { scope: "COURSE" },
		include: { questions: { orderBy: { order: "asc" as const } } },
	},
	_count: { select: { assignments: true } },
};
