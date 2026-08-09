import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type QuizResultsProps = {
	score: number;
	passed: boolean;
};

export const QuizResults = ({ score, passed }: QuizResultsProps) => (
	<Card className="p-8 max-w-3xl mx-auto text-center">
		<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
			{passed ? (
				<CheckCircle className="w-24 h-24 text-green-500 mx-auto" />
			) : (
				<XCircle className="w-24 h-24 text-red-500 mx-auto" />
			)}
		</motion.div>
		<h2 className="text-3xl font-bold mt-4">
			{passed ? "Congratulations!" : "Keep Trying"}
		</h2>
		<p
			className={`text-6xl font-bold my-4 ${passed ? "text-green-500" : "text-red-500"}`}
		>
			{score.toFixed(1)}%
		</p>
		<p className="text-gray-600 mb-6">Passing score: 70%</p>
		<Button onClick={() => window.location.reload()}>Retake Quiz</Button>
	</Card>
);
