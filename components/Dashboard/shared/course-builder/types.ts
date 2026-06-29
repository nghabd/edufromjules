export type QuestionType =
	| "RADIO"
	| "SELECT"
	| "MULTI_SELECT"
	| "TRUE_FALSE"
	| "COMPLETE";

export type MaterialType =
	| "RICH_TEXT"
	| "PDF"
	| "VIDEO"
	| "PRACTICAL"
	| "IMAGE"
	| "DOCUMENT"
	| "PRESENTATION";

export type QuizQuestionDraft = {
	id?: string;
	question: string;
	type: QuestionType;
	options: string[];
	correctAnswers: string[];
	explanation?: string;
	points: number;
};

export type LessonQuizDraft = {
	id?: string;
	title: string;
	passingScore: number;
	timeLimit: number;
	maxAttempts: number;
	questions: QuizQuestionDraft[];
};

export type MaterialDraft = {
	id?: string;
	title: string;
	type: MaterialType;
	url: string;
	content: string;
	storageProvider?: string;
	storagePath?: string;
	storageKey?: string;
	fileSize?: number;
	contentType?: string;
	uploadedAt?: string;
	duration?: number;
	gateQuestion?: string;
	gateAnswer?: string;
};

export type TopicDraft = {
	id?: string;
	title: string;
	description: string;
	materials: MaterialDraft[];
	quiz: LessonQuizDraft | null;
};

export type CourseFormDraft = {
	title: string;
	description: string;
	category: string;
	topics: TopicDraft[];
};

export const questionTypeLabels: Record<QuestionType, string> = {
	RADIO: "Radio",
	SELECT: "Select",
	MULTI_SELECT: "Multi-select",
	TRUE_FALSE: "True / False",
	COMPLETE: "Complete",
};

export const materialTypeLabels: Record<MaterialType, string> = {
	RICH_TEXT: "Article",
	PDF: "PDF",
	VIDEO: "Video",
	PRACTICAL: "Practical",
	IMAGE: "Image",
	DOCUMENT: "Document",
	PRESENTATION: "Presentation",
};
