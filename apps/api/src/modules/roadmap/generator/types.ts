import type { RoadmapItemType } from '@mentra/shared';

/** A plan item references its dependencies by *local* key; resolved to DB ids on persist. */
export type RoadmapPlanItem = {
  key: string;
  type: RoadmapItemType;
  title: string;
  description?: string;
  skillIds: string[];
  estimatedMin?: number;
  dependsOn: string[]; // local keys of items in this plan
};

export type RoadmapPlanWeek = {
  weekNumber: number;
  title: string;
  theme?: string;
  items: RoadmapPlanItem[];
};

export type RoadmapPlan = {
  totalWeeks: number;
  weeks: RoadmapPlanWeek[];
  notes?: string;
};

export type GeneratorSkill = { skillId: string; label: string; score: number; confidence: number };

/** Completed-assignment signal that feeds the AI roadmap generator. */
export type GeneratorAssignment = {
  summary: string;
  score: number | null;
  tasks: { title: string; type: string; skillIds: string[]; correct: boolean | null }[];
  closingAnswers: { prompt: string; answer: string }[];
};

export type GeneratorInput = {
  userId: string;
  skillMatrix: GeneratorSkill[];
  goal: string | null;
  targetRoles: string[];
  techStack: string[];
  studyHoursPerDay: number | null;
  basisAttemptId: string | null;
  assignment: GeneratorAssignment | null;
};
