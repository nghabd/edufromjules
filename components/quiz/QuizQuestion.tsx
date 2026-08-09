import { motion } from 'framer-motion';

type Question = {
  id: string;
  question: string;
  options: string[];
};

type QuizQuestionProps = {
  question?: Question;
  selectedAnswer?: string;
  onAnswer: (id: string, answer: string) => void;
};

export const QuizQuestion = ({ question, selectedAnswer, onAnswer }: QuizQuestionProps) => {
  if (!question) return null;
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-6"
    >
      <h3 className="text-xl font-semibold mb-4">{question.question}</h3>
      <div className="space-y-3">
        {question.options.map((option: string, i: number) => (
          <button
            key={i}
            onClick={() => onAnswer(question.id, option)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedAnswer === option
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
            {option}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
