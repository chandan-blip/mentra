import type { RoadmapTestQuestionRow } from './topic.repository.js';

export type SubmittedAnswer = { questionId: string; selected: number[] };

export type GradedQuestion = {
  questionId: string;
  correct: number[];
  selected: number[];
  isCorrect: boolean;
  pointsAwarded: number;
  points: number;
};

export type GradeOutcome = {
  graded: GradedQuestion[];
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
};

/** Two index sets are equal iff they contain exactly the same indices (order-free). */
function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

/**
 * Grade a submission against the stored questions. A question scores its full
 * points only when the selected option set exactly matches the correct set (no
 * partial credit, no extra selections). Unanswered questions count as wrong.
 */
export function gradeTest(
  questions: RoadmapTestQuestionRow[],
  answers: SubmittedAnswer[],
  passPercent: number,
): GradeOutcome {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.selected]));
  const graded: GradedQuestion[] = questions.map((q) => {
    const selectedRaw = byQuestion.get(q.id) ?? [];
    // Drop out-of-range / duplicate selections defensively.
    const selected = [...new Set(selectedRaw.filter((i) => i >= 0 && i < q.options.length))];
    const isCorrect = selected.length > 0 && sameSet(selected, q.correct);
    return {
      questionId: q.id,
      correct: q.correct,
      selected,
      isCorrect,
      pointsAwarded: isCorrect ? q.points : 0,
      points: q.points,
    };
  });

  const score = graded.reduce((n, g) => n + g.pointsAwarded, 0);
  const maxScore = questions.reduce((n, q) => n + q.points, 0);
  const correctCount = graded.filter((g) => g.isCorrect).length;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    graded,
    score,
    maxScore,
    percent,
    correctCount,
    totalQuestions: questions.length,
    passed: percent >= passPercent,
  };
}
