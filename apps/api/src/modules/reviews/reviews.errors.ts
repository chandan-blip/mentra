/** Typed error for the reviews module — carries an HTTP status + stable code. */
export class ReviewError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}
