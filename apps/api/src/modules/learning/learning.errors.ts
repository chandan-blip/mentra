/** Typed error for the learning (test series) module — mirrors RoadmapError. */
export class LearningError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'LearningError';
  }
}
