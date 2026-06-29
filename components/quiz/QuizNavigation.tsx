import { Button } from '@/components/ui/button';

type QuizNavigationProps = {
  currentIndex: number;
  totalQuestions: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

export const QuizNavigation = ({ currentIndex, totalQuestions, onPrev, onNext, onSubmit }: QuizNavigationProps) => (
  <div className="flex justify-between mt-6">
    <Button variant="outline" onClick={onPrev} disabled={currentIndex === 0}>
      Previous
    </Button>
    {currentIndex === totalQuestions - 1 ? (
      <Button onClick={onSubmit}>Submit Quiz</Button>
    ) : (
      <Button onClick={onNext}>Next</Button>
    )}
  </div>
);
