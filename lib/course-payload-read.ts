// lib/course-payload-read.ts
//
// Read-only Prisma include shape for courses. Deliberately has NO import of
// `@/lib/input-sanitization` (or anything that pulls in jsdom/dompurify) so
// that read-heavy routes like /api/admin/overview don't drag that whole
// module graph into their bundle. That import chain was crashing those
// routes at load time (ERR_REQUIRE_ESM inside jsdom's html-encoding-sniffer
// dependency, incompatible with Turbopack's bundling).
//
// If you only need to READ/LIST/DISPLAY courses, import from this file.
// If you need to CREATE/WRITE course content (which requires sanitizing
// HTML), import from `@/lib/course-payload-write` instead.

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
