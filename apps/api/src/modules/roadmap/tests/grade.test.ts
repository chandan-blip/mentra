import { describe, expect, it } from 'vitest';
import type { RoadmapTestQuestionRow } from '../topic/topic.repository.js';
import { gradeTest } from '../topic/grade.js';

function q(over: Partial<RoadmapTestQuestionRow> & Pick<RoadmapTestQuestionRow, 'id' | 'correct'>): RoadmapTestQuestionRow {
  return {
    testId: 't1',
    subtopicId: null,
    order: 0,
    type: 'single_choice',
    body: '?',
    options: ['a', 'b', 'c', 'd'],
    explanation: null,
    points: 1,
    ...over,
  };
}

describe('gradeTest', () => {
  it('awards full points only for an exact match', () => {
    const questions = [q({ id: 'q1', correct: [2] })];
    const out = gradeTest(questions, [{ questionId: 'q1', selected: [2] }], 70);
    expect(out.score).toBe(1);
    expect(out.maxScore).toBe(1);
    expect(out.percent).toBe(100);
    expect(out.correctCount).toBe(1);
    expect(out.passed).toBe(true);
  });

  it('scores a wrong single-choice answer as zero', () => {
    const questions = [q({ id: 'q1', correct: [2] })];
    const out = gradeTest(questions, [{ questionId: 'q1', selected: [0] }], 70);
    expect(out.score).toBe(0);
    expect(out.percent).toBe(0);
    expect(out.passed).toBe(false);
  });

  it('requires the full set for multi-choice (no partial credit)', () => {
    const questions = [q({ id: 'q1', type: 'multi_choice', correct: [0, 2], points: 2 })];
    const partial = gradeTest(questions, [{ questionId: 'q1', selected: [0] }], 70);
    expect(partial.score).toBe(0);
    const exact = gradeTest(questions, [{ questionId: 'q1', selected: [2, 0] }], 70);
    expect(exact.score).toBe(2);
    expect(exact.passed).toBe(true);
  });

  it('treats an extra selection on multi-choice as wrong', () => {
    const questions = [q({ id: 'q1', type: 'multi_choice', correct: [0, 2] })];
    const out = gradeTest(questions, [{ questionId: 'q1', selected: [0, 1, 2] }], 70);
    expect(out.graded[0]!.isCorrect).toBe(false);
    expect(out.score).toBe(0);
  });

  it('ignores out-of-range and duplicate selections', () => {
    const questions = [q({ id: 'q1', correct: [1] })];
    const out = gradeTest(questions, [{ questionId: 'q1', selected: [1, 1, 9, -3] }], 70);
    expect(out.graded[0]!.selected).toEqual([1]);
    expect(out.score).toBe(1);
  });

  it('counts unanswered questions as wrong', () => {
    const questions = [q({ id: 'q1', correct: [0] }), q({ id: 'q2', correct: [1] })];
    const out = gradeTest(questions, [{ questionId: 'q1', selected: [0] }], 70);
    expect(out.correctCount).toBe(1);
    expect(out.totalQuestions).toBe(2);
    expect(out.percent).toBe(50);
    expect(out.passed).toBe(false);
  });

  it('weights points by question difficulty', () => {
    const questions = [
      q({ id: 'q1', correct: [0], points: 1 }),
      q({ id: 'q2', correct: [0], points: 3 }),
    ];
    // Only the heavy question correct → 3/4 = 75%.
    const out = gradeTest(
      questions,
      [
        { questionId: 'q1', selected: [1] },
        { questionId: 'q2', selected: [0] },
      ],
      70,
    );
    expect(out.score).toBe(3);
    expect(out.maxScore).toBe(4);
    expect(out.percent).toBe(75);
    expect(out.passed).toBe(true);
  });

  it('passes exactly at the threshold', () => {
    const questions = [
      q({ id: 'q1', correct: [0] }),
      q({ id: 'q2', correct: [0] }),
      q({ id: 'q3', correct: [0] }),
      q({ id: 'q4', correct: [0] }),
    ];
    const out = gradeTest(
      questions,
      [
        { questionId: 'q1', selected: [0] },
        { questionId: 'q2', selected: [0] },
        { questionId: 'q3', selected: [0] },
        { questionId: 'q4', selected: [1] },
      ],
      75,
    );
    expect(out.percent).toBe(75);
    expect(out.passed).toBe(true);
  });
});
