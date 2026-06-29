"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	createDefaultQuestion,
	createDefaultQuiz,
} from "./defaults";
import {
	type LessonQuizDraft,
	type QuestionType,
	questionTypeLabels,
} from "./types";

type QuizEditorProps = {
	quiz: LessonQuizDraft | null;
	onChange: (quiz: LessonQuizDraft | null) => void;
};

export function QuizEditor({ quiz, onChange }: QuizEditorProps) {
	if (!quiz) {
		return (
			<div className="rounded-md border border-border bg-muted/20 p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-sm font-semibold">Lesson Quiz</p>
						<p className="text-xs text-muted-foreground">
							No quiz attached to this lesson.
						</p>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => onChange(createDefaultQuiz())}
					>
						<Plus className="mr-1 h-4 w-4" />
						Add Quiz
					</Button>
				</div>
			</div>
		);
	}

	const updateQuestion = (
		index: number,
		patch: Partial<LessonQuizDraft["questions"][number]>,
	) => {
		onChange({
			...quiz,
			questions: quiz.questions.map((question, qIndex) =>
				qIndex === index ? { ...question, ...patch } : question,
			),
		});
	};

	const removeQuestion = (index: number) => {
		const nextQuestions = quiz.questions.filter((_, qIndex) => qIndex !== index);
		onChange({
			...quiz,
			questions: nextQuestions.length ? nextQuestions : [createDefaultQuestion()],
		});
	};

	const changeQuestionType = (index: number, type: QuestionType) => {
		const current = quiz.questions[index];
		const next = createDefaultQuestion(type);
		updateQuestion(index, {
			...next,
			question: current.question,
			explanation: current.explanation,
			points: current.points,
		});
	};

	const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
		const question = quiz.questions[questionIndex];
		const previousOption = question.options[optionIndex];
		const options = question.options.map((option, index) =>
			index === optionIndex ? value : option,
		);
		const correctAnswers = question.correctAnswers.map((answer) =>
			answer === previousOption ? value : answer,
		);
		updateQuestion(questionIndex, { options, correctAnswers });
	};

	const toggleCorrectAnswer = (questionIndex: number, option: string) => {
		const question = quiz.questions[questionIndex];
		if (question.type === "MULTI_SELECT") {
			const exists = question.correctAnswers.includes(option);
			updateQuestion(questionIndex, {
				correctAnswers: exists
					? question.correctAnswers.filter((answer) => answer !== option)
					: [...question.correctAnswers, option],
			});
			return;
		}
		updateQuestion(questionIndex, { correctAnswers: [option] });
	};

	return (
		<div className="rounded-md border border-border bg-muted/20">
			<div className="flex items-center justify-between gap-3 border-b border-border p-3">
				<div>
					<p className="text-sm font-semibold">Lesson Quiz</p>
					<p className="text-xs text-muted-foreground">
						{quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					className="text-destructive"
					onClick={() => onChange(null)}
				>
					<Trash2 className="mr-1 h-4 w-4" />
					Remove
				</Button>
			</div>

			<div className="space-y-4 p-3">
				<div className="grid gap-3 md:grid-cols-[1fr_110px_110px_110px]">
					<Field label="Quiz Title">
						<Input
							value={quiz.title}
							onChange={(event) =>
								onChange({ ...quiz, title: event.target.value })
							}
						/>
					</Field>
					<Field label="Pass %">
						<Input
							type="number"
							min={1}
							max={100}
							value={quiz.passingScore}
							onChange={(event) =>
								onChange({
									...quiz,
									passingScore: Number(event.target.value),
								})
							}
						/>
					</Field>
					<Field label="Minutes">
						<Input
							type="number"
							min={1}
							max={240}
							value={quiz.timeLimit}
							onChange={(event) =>
								onChange({ ...quiz, timeLimit: Number(event.target.value) })
							}
						/>
					</Field>
					<Field label="Attempts">
						<Input
							type="number"
							min={1}
							max={20}
							value={quiz.maxAttempts}
							onChange={(event) =>
								onChange({ ...quiz, maxAttempts: Number(event.target.value) })
							}
						/>
					</Field>
				</div>

				{quiz.questions.map((question, questionIndex) => (
					<div
						key={questionIndex}
						className="rounded-md border border-border bg-background p-3"
					>
						<div className="mb-3 flex items-center justify-between gap-3">
							<p className="text-xs font-bold uppercase text-muted-foreground">
								Question {questionIndex + 1}
							</p>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-8 text-destructive"
								onClick={() => removeQuestion(questionIndex)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>

						<div className="grid gap-3 md:grid-cols-[1fr_160px_90px]">
							<Field label="Question">
								<Input
									value={question.question}
									onChange={(event) =>
										updateQuestion(questionIndex, {
											question: event.target.value,
										})
									}
								/>
							</Field>
							<Field label="Type">
								<select
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									value={question.type}
									onChange={(event) =>
										changeQuestionType(
											questionIndex,
											event.target.value as QuestionType,
										)
									}
								>
									{Object.entries(questionTypeLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</Field>
							<Field label="Points">
								<Input
									type="number"
									min={1}
									max={100}
									value={question.points}
									onChange={(event) =>
										updateQuestion(questionIndex, {
											points: Number(event.target.value),
										})
									}
								/>
							</Field>
						</div>

						<div className="mt-3 space-y-2">
							{question.type === "COMPLETE" ? (
								<Field label="Correct Answer">
									<Input
										value={question.correctAnswers[0] || ""}
										onChange={(event) =>
											updateQuestion(questionIndex, {
												correctAnswers: [event.target.value],
											})
										}
									/>
								</Field>
							) : (
								<QuestionOptions
									questionIndex={questionIndex}
									quiz={quiz}
									onChange={onChange}
									onCorrectToggle={toggleCorrectAnswer}
									onOptionChange={updateOption}
								/>
							)}
						</div>

						<Field label="Explanation">
							<Input
								value={question.explanation || ""}
								onChange={(event) =>
									updateQuestion(questionIndex, {
										explanation: event.target.value,
									})
								}
							/>
						</Field>
					</div>
				))}

				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() =>
						onChange({
							...quiz,
							questions: [...quiz.questions, createDefaultQuestion()],
						})
					}
				>
					<Plus className="mr-1 h-4 w-4" />
					Add Question
				</Button>
			</div>
		</div>
	);
}

function QuestionOptions({
	questionIndex,
	quiz,
	onChange,
	onCorrectToggle,
	onOptionChange,
}: {
	questionIndex: number;
	quiz: LessonQuizDraft;
	onChange: (quiz: LessonQuizDraft | null) => void;
	onCorrectToggle: (questionIndex: number, option: string) => void;
	onOptionChange: (
		questionIndex: number,
		optionIndex: number,
		value: string,
	) => void;
}) {
	const question = quiz.questions[questionIndex];
	const inputType = question.type === "MULTI_SELECT" ? "checkbox" : "radio";

	return (
		<div className="space-y-2">
			{question.options.map((option, optionIndex) => (
				<div key={optionIndex} className="flex items-center gap-2">
					<input
						type={inputType}
						name={`question-${questionIndex}`}
						className="h-4 w-4"
						checked={question.correctAnswers.includes(option)}
						onChange={() => onCorrectToggle(questionIndex, option)}
					/>
					<Input
						value={option}
						disabled={question.type === "TRUE_FALSE"}
						onChange={(event) =>
							onOptionChange(questionIndex, optionIndex, event.target.value)
						}
					/>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-10 w-10 p-0 text-destructive"
						disabled={question.type === "TRUE_FALSE" || question.options.length <= 2}
						onClick={() => {
							const nextOptions = question.options.filter(
								(_, index) => index !== optionIndex,
							);
							onChange({
								...quiz,
								questions: quiz.questions.map((item, index) =>
									index === questionIndex
										? {
												...item,
												options: nextOptions,
												correctAnswers: item.correctAnswers.filter((answer) =>
													nextOptions.includes(answer),
												),
											}
										: item,
								),
							});
						}}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			))}
			{question.type !== "TRUE_FALSE" && (
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() =>
						onChange({
							...quiz,
							questions: quiz.questions.map((item, index) =>
								index === questionIndex
									? {
											...item,
											options: [
												...item.options,
												`Option ${item.options.length + 1}`,
											],
										}
									: item,
							),
						})
					}
				>
					<Plus className="mr-1 h-4 w-4" />
					Add Option
				</Button>
			)}
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<label className="block space-y-1 text-sm font-medium">
			<span>{label}</span>
			{children}
		</label>
	);
}
