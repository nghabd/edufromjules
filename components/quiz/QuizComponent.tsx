"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import toast from "react-hot-toast";

interface Question {
	id: string;
	question: string;
	options: string[];
	correctAnswer: string;
	explanation?: string;
	points: number;
}

interface QuizProps {
	quizId: string;
	questions: Question[];
	timeLimit: number; // minutes
	passingScore: number;
	onComplete: (score: number, passed: boolean) => void;
}

export const QuizComponent: React.FC<QuizProps> = ({
	quizId,
	questions,
	timeLimit,
	passingScore,
	onComplete,
}) => {
	const [currentQuestion, setCurrentQuestion] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
	const [attemptId, setAttemptId] = useState<string | null>(null);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [score, setScore] = useState(0);
	const [showExplanation, setShowExplanation] = useState(false);
	const [, setTabSwitchCount] = useState(0);

	const calculateScore = useCallback(() => {
		let correctCount = 0;
		questions.forEach((q) => {
			if (answers[q.id] === q.correctAnswer) {
				correctCount += q.points;
			}
		});
		return (
			(correctCount / questions.reduce((acc, q) => acc + q.points, 0)) * 100
		);
	}, [answers, questions]);

	useEffect(() => {
		let cancelled = false;

		const startQuiz = async () => {
			try {
				const response = await fetch(`/api/quizzes/${quizId}/start`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
				});
				const payload = await response.json().catch(() => ({}));

				if (!response.ok) {
					const message =
						typeof payload.message === "string"
							? payload.message
							: "Failed to start quiz";
					toast.error(message);
					return;
				}

				if (cancelled) return;
				const expiresAt = new Date(payload.expiresAt).getTime();
				const serverNow = new Date(payload.serverNow).getTime();
				setAttemptId(payload.attemptId);
				setTimeLeft(Math.max(0, Math.ceil((expiresAt - serverNow) / 1000)));
			} catch {
				if (!cancelled) toast.error("Failed to start quiz");
			}
		};

		void startQuiz();

		return () => {
			cancelled = true;
		};
	}, [quizId]);

	const handleSubmit = useCallback(async () => {
		if (!attemptId) {
			toast.error("Quiz attempt is not ready yet.");
			return;
		}

		try {
			const response = await fetch("/api/quizzes/submit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					quizId,
					attemptId,
					answers,
				}),
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				const message =
					typeof payload.message === "string"
						? payload.message
						: "Failed to submit quiz";
				toast.error(message);
				return;
			}

			const finalScore = Number(payload.score) || calculateScore();
			const passed = Boolean(payload.passed);
			setScore(finalScore);
			setIsSubmitted(true);

			onComplete(finalScore, passed);

			if (passed) {
				toast.success("Congratulations! You passed the quiz!");
			} else {
				toast.error("You did not meet the passing score. You can retry later.");
			}
		} catch {
			toast.error("Failed to submit quiz");
		}
	}, [
		attemptId,
		answers,
		calculateScore,
		onComplete,
		quizId,
	]);

	// Anti-cheating: Detect tab switch
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				setTabSwitchCount((prev) => {
					const newCount = prev + 1;
					if (newCount >= 3) {
						toast.error("Quiz terminated due to multiple tab switches");
						handleSubmit();
					} else {
						toast.error(`Warning: Tab switch detected (${newCount}/3)`);
					}
					return newCount;
				});
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [handleSubmit]);

	// Timer
	useEffect(() => {
		if (timeLeft <= 0 || isSubmitted) return;

		const timer = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					toast.error("Time is up! Quiz submitted automatically.");
					handleSubmit();
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [handleSubmit, isSubmitted, timeLeft]);

	const handleAnswer = (questionId: string, answer: string) => {
		if (isSubmitted) return;
		setAnswers((prev) => ({ ...prev, [questionId]: answer }));
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (isSubmitted) {
		return (
			<Card className="p-8 max-w-3xl mx-auto">
				<div className="text-center">
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 200 }}
					>
						{score >= passingScore ? (
							<CheckCircle className="w-24 h-24 text-green-500 mx-auto" />
						) : (
							<XCircle className="w-24 h-24 text-red-500 mx-auto" />
						)}
					</motion.div>

					<h2 className="text-3xl font-bold mt-4">
						{score >= passingScore ? "Congratulations!" : "Keep Trying!"}
					</h2>

					<p
						className={`text-6xl font-bold my-4 ${
							score >= passingScore ? "text-green-500" : "text-red-500"
						}`}
					>
						{score.toFixed(1)}%
					</p>

					<p className="text-gray-600 mb-6">Passing score: {passingScore}%</p>

					<div className="grid grid-cols-2 gap-4 mt-8">
						<div className="bg-gray-50 p-4 rounded-lg">
							<p className="text-sm text-gray-600">Correct Answers</p>
							<p className="text-2xl font-bold">
								{
									questions.filter((q) => answers[q.id] === q.correctAnswer)
										.length
								}
								/{questions.length}
							</p>
						</div>
						<div className="bg-gray-50 p-4 rounded-lg">
							<p className="text-sm text-gray-600">Time Taken</p>
							<p className="text-2xl font-bold">
								{formatTime(timeLimit * 60 - timeLeft)}
							</p>
						</div>
					</div>

					<Button
						onClick={() => setShowExplanation(!showExplanation)}
						className="mt-6 mr-4"
					>
						{showExplanation ? "Hide" : "Show"} Explanations
					</Button>

					{score < passingScore && (
						<Button
							variant="outline"
							className="mt-6"
							onClick={() => window.location.reload()}
						>
							Retry Quiz
						</Button>
					)}
				</div>

				{showExplanation && (
					<div className="mt-8 space-y-4">
						{questions.map((q, index) => (
							<div key={q.id} className="bg-gray-50 p-4 rounded-lg">
								<p className="font-semibold">
									{index + 1}. {q.question}
								</p>
								<p className="text-sm mt-2">
									Your answer:{" "}
									<span
										className={
											answers[q.id] === q.correctAnswer
												? "text-green-600"
												: "text-red-600"
										}
									>
										{answers[q.id] || "Not answered"}
									</span>
								</p>
								<p className="text-sm text-green-600">
									Correct answer: {q.correctAnswer}
								</p>
								{q.explanation && (
									<p className="text-sm text-gray-600 mt-2">
										Explanation: {q.explanation}
									</p>
								)}
							</div>
						))}
					</div>
				)}
			</Card>
		);
	}

	const currentQ = questions[currentQuestion];
	const progress = ((currentQuestion + 1) / questions.length) * 100;

	return (
		<div className="max-w-3xl mx-auto">
			<Card className="p-6">
				{/* Header */}
				<div className="flex justify-between items-center mb-6">
					<div>
						<p className="text-sm text-gray-600">
							Question {currentQuestion + 1} of {questions.length}
						</p>
						<Progress value={progress} className="w-48 mt-2" />
					</div>
					<div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg">
						<Timer className="w-5 h-5 text-orange-600" />
						<span className="font-mono text-lg font-bold text-orange-600">
							{formatTime(timeLeft)}
						</span>
					</div>
				</div>

				{/* Question */}
				<AnimatePresence mode="wait">
					<motion.div
						key={currentQuestion}
						initial={{ x: 50, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: -50, opacity: 0 }}
						transition={{ duration: 0.3 }}
					>
						<h3 className="text-xl font-semibold mb-6">{currentQ.question}</h3>

						<div className="space-y-3">
							{currentQ.options.map((option, index) => (
								<motion.button
									key={index}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
									onClick={() => handleAnswer(currentQ.id, option)}
									className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
										answers[currentQ.id] === option
											? "border-blue-500 bg-blue-50"
											: "border-gray-200 hover:border-blue-300"
									}`}
								>
									<span className="font-semibold mr-2">
										{String.fromCharCode(65 + index)}.
									</span>
									{option}
								</motion.button>
							))}
						</div>
					</motion.div>
				</AnimatePresence>

				{/* Navigation */}
				<div className="flex justify-between mt-8">
					<Button
						variant="outline"
						onClick={() => setCurrentQuestion((prev) => prev - 1)}
						disabled={currentQuestion === 0}
					>
						Previous
					</Button>

					{currentQuestion === questions.length - 1 ? (
						<Button
							onClick={handleSubmit}
							disabled={Object.keys(answers).length < questions.length}
						>
							Submit Quiz
						</Button>
					) : (
						<Button onClick={() => setCurrentQuestion((prev) => prev + 1)}>
							Next
						</Button>
					)}
				</div>
			</Card>
		</div>
	);
};
