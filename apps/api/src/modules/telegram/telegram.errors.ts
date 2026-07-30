/** Domain error for the Telegram module — carries the HTTP status the route should send. */
export class TelegramError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'TelegramError';
  }
}
