/** Typed error for the coding module — mirrors LearningError. */
export class CodingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'CodingError';
  }
}
