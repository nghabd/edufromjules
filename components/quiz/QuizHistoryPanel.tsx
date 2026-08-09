"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
	CheckCircle2,
	XCircle,
	Clock,
	ChevronDown,
	ChevronUp,
	Trophy,
	BarChart2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type QuizAttempt = {
	id: string;
	quizId: string;
	quizTitle: string;
	passingScore: number;
	score: number;
	passed: boolean;
	attemptNumber: number;
	startedAt: string;
	completedAt?: string | null;
	timeTakenSeconds?: number | null;
	questions: Array<{
		id: string;
		question: string;
		type: string;
		options: string[];
		userAnswer: string[];
		correctAnswer: string[];
		explanation?: string | null;
		isCorrect: boolean;
		points: number;
	}>;
};

function formatTime(seconds: number) {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}m ${s}s`;
}

export function QuizHistoryPanel() {
	const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
	const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

	const { data, isLoading } = useQuery<{ attempts: QuizAttempt[] }>({
		queryKey: ["quiz-history"],
		queryFn: async () => (await axios.get("/api/pharmacist/quiz-history")).data,
	});

	const attempts = data?.attempts ?? [];

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
				))}
			</div>
		);
	}

	if (attempts.length === 0) {
		return (
			<div className="flex flex-col items-center py-16">
				<BarChart2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
				<h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
					No quiz attempts yet
				</h3>
				<p className="text-sm text-slate-500 dark:text-slate-400">
					Complete a quiz to see your history here.
				</p>
			</div>
		);
	}

	// Group by quizId
	const grouped = attempts.reduce<Record<string, QuizAttempt[]>>((acc, a) => {
		if (!acc[a.quizId]) acc[a.quizId] = [];
		acc[a.quizId].push(a);
		return acc;
	}, {});

	return (
		<div className="space-y-4">
			{Object.entries(grouped).map(([quizId, quizAttempts]) => {
				const best = quizAttempts.reduce((b, a) =>
					a.score > b.score ? a : b,
				);
				const passed = quizAttempts.some((a) => a.passed);

				return (
					<Card key={quizId} className="overflow-hidden">
						<div className="p-4 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
							<div className="flex items-center gap-3">
								{passed ? (
									<Trophy className="h-5 w-5 text-amber-500 flex-shrink-0" />
								) : (
									<BarChart2 className="h-5 w-5 text-slate-400 flex-shrink-0" />
								)}
								<div>
									<p className="font-semibold text-slate-900 dark:text-white">
										{quizAttempts[0].quizTitle}
									</p>
									<p className="text-xs text-slate-500 dark:text-slate-400">
										{quizAttempts.length} attempt{quizAttempts.length !== 1 ? "s" : ""} · Best score:{" "}
										<span className={`font-semibold ${passed ? "text-emerald-600" : "text-red-500"}`}>
											{best.score.toFixed(1)}%
										</span>
									</p>
								</div>
							</div>
							<Badge
								className={
									passed
										? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
										: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
								}
							>
								{passed ? "Passed" : "Failed"}
							</Badge>
						</div>

						<div className="divide-y divide-slate-100 dark:divide-slate-800">
							{quizAttempts.map((attempt) => (
								<div key={attempt.id}>
									<button
										className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
										onClick={() =>
											setExpandedAttempt(
												expandedAttempt === attempt.id
													? null
													: attempt.id,
											)
										}
									>
										<div className="flex items-center gap-3">
											{attempt.passed ? (
												<CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
											) : (
												<XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
											)}
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="text-sm text-slate-700 dark:text-slate-300">
														Attempt #{attempt.attemptNumber}
													</span>
													<span
														className={`text-sm font-semibold ${attempt.passed ? "text-emerald-600" : "text-red-500"}`}
													>
														{attempt.score.toFixed(1)}%
													</span>
													<span className="text-xs text-slate-400">
														(passing: {attempt.passingScore}%)
													</span>
												</div>
												<div className="flex items-center gap-3 mt-0.5">
													<span className="text-xs text-slate-400">
														{attempt.completedAt
															? format(new Date(attempt.completedAt), "d MMM yyyy, HH:mm")
															: "In progress"}
													</span>
													{attempt.timeTakenSeconds && (
														<span className="flex items-center gap-1 text-xs text-slate-400">
															<Clock className="h-3 w-3" />
															{formatTime(attempt.timeTakenSeconds)}
														</span>
													)}
												</div>
											</div>
											{expandedAttempt === attempt.id ? (
												<ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
											) : (
												<ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
											)}
										</div>
									</button>

									{expandedAttempt === attempt.id && (
										<div className="px-4 pb-4 bg-slate-50/30 dark:bg-slate-800/20">
											<div className="space-y-2 pt-2">
												{attempt.questions.map((q, qi) => (
													<div key={q.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
														<button
															className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors"
															onClick={() =>
																setExpandedQuestion(
																	expandedQuestion === `${attempt.id}-${q.id}`
																		? null
																		: `${attempt.id}-${q.id}`,
																)
															}
														>
															{q.isCorrect ? (
																<CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
															) : (
																<XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
															)}
															<span className="text-sm text-slate-800 dark:text-slate-200 flex-1 text-left">
																<span className="text-slate-400 mr-1">Q{qi + 1}.</span>
																{q.question}
															</span>
															<span className="text-xs text-slate-400 flex-shrink-0">
																{q.points} pt{q.points !== 1 ? "s" : ""}
															</span>
														</button>

														{expandedQuestion === `${attempt.id}-${q.id}` && (
															<div className="px-3 pb-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
																<div className="pt-2 space-y-1.5">
																	<div className="flex gap-2 text-xs">
																		<span className="text-slate-500 flex-shrink-0">Your answer:</span>
																		<span className={q.isCorrect ? "text-emerald-600 font-medium" : "text-red-500 font-medium line-through"}>
																			{q.userAnswer.join(", ") || "(no answer)"}
																		</span>
																	</div>
																	{!q.isCorrect && (
																		<div className="flex gap-2 text-xs">
																			<span className="text-slate-500 flex-shrink-0">Correct answer:</span>
																			<span className="text-emerald-600 font-medium">
																				{q.correctAnswer.join(", ")}
																			</span>
																		</div>
																	)}
																	{q.explanation && (
																		<p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
																			💡 {q.explanation}
																		</p>
																	)}
																</div>
															</div>
														)}
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					</Card>
				);
			})}
		</div>
	);
}
