import { Dispatch, SetStateAction, useEffect } from 'react';
import { Timer } from 'lucide-react';

type QuizTimerProps = {
  timeLeft: number;
  setTimeLeft: Dispatch<SetStateAction<number>>;
  onSubmit: () => void;
};

export const QuizTimer = ({ timeLeft, setTimeLeft, onSubmit }: QuizTimerProps) => {
  useEffect(() => {
    if (timeLeft <= 0) {
      onSubmit();
      return;
    }
    const id = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(id);
          onSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onSubmit, setTimeLeft, timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg mb-6">
      <Timer className="w-5 h-5 text-orange-600" />
      <span className="font-mono text-lg font-bold text-orange-600">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};
