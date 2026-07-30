/** Domain error for the SMM module — carries the HTTP status the route should send. */
export class SmmError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'SmmError';
  }
}
