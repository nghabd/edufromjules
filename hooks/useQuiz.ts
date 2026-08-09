import { useState, useCallback } from 'react';

type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
};

export function useQuiz(questions: Question[], timeLimit: number) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  const next = () => setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
  const prev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  const calculateScore = (): number => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) correct += q.points;
    });
    return (correct / questions.reduce((sum, q) => sum + q.points, 0)) * 100;
  };

  const submit = () => {
    setSubmitted(true);
    return calculateScore();
  };

  return {
    currentQuestion: questions[currentIndex],
    currentIndex,
    totalQuestions: questions.length,
    answers,
    timeLeft,
    submitted,
    handleAnswer,
    next,
    prev,
    submit,
    setTimeLeft,
  };
}
