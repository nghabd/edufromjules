'use client';
import { useState } from 'react';
import { useQuiz } from '@/hooks/useQuiz';
import { QuizTimer } from './QuizTimer';
import { QuizQuestion } from './QuizQuestion';
import { QuizNavigation } from './QuizNavigation';
import { QuizResults } from './QuizResults';

type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
};

type QuizContainerProps = {
  questions: Question[];
  timeLimit: number;
  passingScore: number;
  onComplete: (score: number, passed: boolean) => void;
};

export const QuizContainer = ({ questions, timeLimit, passingScore, onComplete }: QuizContainerProps) => {
  const quiz = useQuiz(questions, timeLimit);
  const [score, setScore] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);

  const handleSubmit = async () => {
    const finalScore = quiz.submit();
    setScore(finalScore);
    const didPass = finalScore >= passingScore;
    setPassed(didPass);
    onComplete(finalScore, didPass);
  };

  if (score !== null) {
    return <QuizResults score={score} passed={passed} />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <QuizTimer timeLeft={quiz.timeLeft} setTimeLeft={quiz.setTimeLeft} onSubmit={handleSubmit} />
      <QuizQuestion
        question={quiz.currentQuestion}
        selectedAnswer={quiz.answers[quiz.currentQuestion.id]}
        onAnswer={(id: string, answer: string) => quiz.handleAnswer(id, answer)}
      />
      <QuizNavigation
        currentIndex={quiz.currentIndex}
        totalQuestions={quiz.totalQuestions}
        onPrev={quiz.prev}
        onNext={quiz.next}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
