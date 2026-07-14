/** Typed error for the ai-prompt module — the route handler maps `status`/`code`. */
export class AiPromptError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AiPromptError';
  }
}
