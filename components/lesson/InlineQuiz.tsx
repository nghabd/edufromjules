"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Timer } from "lucide-react";

type InlineQuizQuestion = {
	id: string;
	question: string;
	type?: "RADIO" | "SELECT" | "MULTI_SELECT" | "TRUE_FALSE" | "COMPLETE";
	options: string[];
};

type InlineQuizData = {
	id: string;
	title: string;
	passingScore: number;
	timeLimit: number;
	bestScore: number;
	questions: InlineQuizQuestion[];
};

type QuizStartResponse = {
	attemptId: string;
	attemptNumber: number;
	expiresAt: string;
	serverNow: string;
	timeLimitSeconds: number;
};

export function InlineQuiz({
	quiz,
	onComplete,
}: {
	quiz: InlineQuizData;
	onComplete: () => void;
}) {
	const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
	const [attemptId, setAttemptId] = useState<string | null>(null);
	const [timeLeft, setTimeLeft] = useState(0);
	const [isStarting, setIsStarting] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Security check: Lock the quiz instantly if they pass locally or already passed before
	const [localPass, setLocalPass] = useState(false);
	const hasPassed = quiz.bestScore >= quiz.passingScore || localPass;

	const startQuiz = async () => {
		setIsStarting(true);
		setAnswers({});
		try {
			const response = await axios.post<QuizStartResponse>(
				`/api/quizzes/${quiz.id}/start`,
			);
			const expiresAt = new Date(response.data.expiresAt).getTime();
			const serverNow = new Date(response.data.serverNow).getTime();
			const remainingSeconds = Math.max(
				0,
				Math.ceil((expiresAt - serverNow) / 1000),
			);

			setAttemptId(response.data.attemptId);
			setTimeLeft(remainingSeconds || response.data.timeLimitSeconds);
			toast.success(`Quiz attempt ${response.data.attemptNumber} started`);
		} catch (err: unknown) {
			if (axios.isAxiosError(err)) {
				const message = err.response?.data?.message;
				toast.error(typeof message === "string" ? message : "Failed to start quiz");
				return;
			}
			toast.error("Failed to start quiz");
		} finally {
			setIsStarting(false);
		}
	};

	const handleSubmit = useCallback(async () => {
		if (!attemptId) {
			toast.error("Start the quiz before submitting answers.");
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await axios.post("/api/quizzes/submit", {
				quizId: quiz.id,
				attemptId,
				answers,
			});
			if (res.data.passed) {
				toast.success(`Passed with ${res.data.score}%!`);
				setLocalPass(true); // Lock the UI instantly
				onComplete(); // Tell the dashboard to refresh the progress bar
			} else {
				toast.error(
					`Scored ${res.data.score}%. You need ${quiz.passingScore}% to pass.`,
				);
				setAttemptId(null);
				setTimeLeft(0);
			}
		} catch (err: unknown) {
			if (axios.isAxiosError(err)) {
				const message = err.response?.data?.message;
				toast.error(typeof message === "string" ? message : "Failed to submit quiz");
				setAttemptId(null);
				setTimeLeft(0);
				return;
			}
			toast.error("Failed to submit quiz");
			setAttemptId(null);
			setTimeLeft(0);
		} finally {
			setIsSubmitting(false);
		}
	}, [answers, attemptId, quiz.id, quiz.passingScore, onComplete]);

	useEffect(() => {
		if (!attemptId || hasPassed) return;
		const interval = window.setInterval(() => {
			setTimeLeft((current) => Math.max(0, current - 1));
		}, 1000);

		return () => window.clearInterval(interval);
	}, [attemptId, hasPassed]);

	useEffect(() => {
		if (!attemptId || isSubmitting || hasPassed || timeLeft !== 0) return;
		const timeout = window.setTimeout(() => {
			void handleSubmit();
		}, 0);
		return () => window.clearTimeout(timeout);
	}, [attemptId, handleSubmit, hasPassed, isSubmitting, timeLeft]);

	const setSingleAnswer = (questionId: string, answer: string) => {
		setAnswers((current) => ({ ...current, [questionId]: answer }));
	};

	const toggleMultiAnswer = (questionId: string, answer: string) => {
		setAnswers((current) => {
			const existing = Array.isArray(current[questionId])
				? (current[questionId] as string[])
				: [];
			const next = existing.includes(answer)
				? existing.filter((item) => item !== answer)
				: [...existing, answer];
			return { ...current, [questionId]: next };
		});
	};

	const isQuestionAnswered = (question: InlineQuizQuestion) => {
		const answer = answers[question.id];
		if (Array.isArray(answer)) return answer.length > 0;
		return typeof answer === "string" && answer.trim().length > 0;
	};

	const formatTime = (seconds: number) => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	if (hasPassed) {
		return (
			<div className="p-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center shadow-sm">
				<CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
				<h3 className="text-xl font-bold text-green-900 dark:text-green-300">
					Quiz Completed!
				</h3>
				<p className="text-sm text-green-700 dark:text-green-400 mt-2">
					You passed this quiz and the score has been securely recorded.
				</p>
			</div>
		);
	}

	if (!attemptId) {
		return (
			<div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="font-bold text-blue-900 dark:text-blue-300">
							{quiz.title}
						</h3>
						<p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
							Time limit: {quiz.timeLimit} minute{quiz.timeLimit === 1 ? "" : "s"}
						</p>
					</div>
					<Button
						type="button"
						onClick={startQuiz}
						disabled={isStarting}
						className="bg-blue-600 text-white hover:bg-blue-700"
					>
						{isStarting ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Start quiz
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
				<h3 className="font-bold text-blue-900 dark:text-blue-300">
					{quiz.title}
				</h3>
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 dark:text-orange-300 bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm">
						<Timer className="h-4 w-4" />
						{formatTime(timeLeft)}
					</span>
					<span className="text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm">
						Target: {quiz.passingScore}%
					</span>
				</div>
			</div>

			{quiz.questions.map((q, i) => (
				<div
					key={q.id}
					className="p-5 border border-slate-200 dark:border-slate-700 rounded-lg bg-card shadow-sm"
				>
					<p className="font-semibold mb-4 text-foreground text-lg">
						{i + 1}. {q.question}
					</p>
					<QuestionAnswer
						question={q}
						answer={answers[q.id]}
						onSingleAnswer={(answer) => setSingleAnswer(q.id, answer)}
						onMultiAnswer={(answer) => toggleMultiAnswer(q.id, answer)}
					/>
				</div>
			))}

			<Button
				onClick={handleSubmit}
				disabled={
					isSubmitting || !quiz.questions.every((q) => isQuestionAnswered(q))
				}
				className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white"
			>
				{isSubmitting ? (
					<Loader2 className="w-5 h-5 animate-spin mr-2" />
				) : null}
				{!quiz.questions.every((q) => isQuestionAnswered(q))
					? "Answer all questions to submit"
					: "Submit Final Answers"}
			</Button>
		</div>
	);
}

function QuestionAnswer({
	question,
	answer,
	onSingleAnswer,
	onMultiAnswer,
}: {
	question: InlineQuizQuestion;
	answer: string | string[] | undefined;
	onSingleAnswer: (answer: string) => void;
	onMultiAnswer: (answer: string) => void;
}) {
	if (question.type === "COMPLETE") {
		return (
			<input
				value={typeof answer === "string" ? answer : ""}
				onChange={(event) => onSingleAnswer(event.target.value)}
				className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
		);
	}

	const inputType = question.type === "MULTI_SELECT" ? "checkbox" : "radio";

	return (
		<div className="space-y-3">
			{question.options.map((opt: string) => {
				const checked = Array.isArray(answer)
					? answer.includes(opt)
					: answer === opt;
				return (
					<label
						key={opt}
						className={`flex cursor-pointer items-center space-x-3 rounded-md border p-3 transition-colors ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 hover:bg-muted dark:border-slate-700"}`}
					>
						<input
							type={inputType}
							name={question.id}
							className="h-4 w-4 text-blue-600 focus:ring-blue-500"
							checked={checked}
							onChange={() =>
								question.type === "MULTI_SELECT"
									? onMultiAnswer(opt)
									: onSingleAnswer(opt)
							}
						/>
						<span className="text-sm font-medium text-foreground">{opt}</span>
					</label>
				);
			})}
		</div>
	);
}
