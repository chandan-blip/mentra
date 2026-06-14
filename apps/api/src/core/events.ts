import { EventEmitter } from 'node:events';
import { logger } from '../logger.js';

/**
 * In-process domain event bus. Mentra is a modular monolith, so cross-module
 * events stay in-process. Swap the transport here (Redis pub/sub, queue) if we
 * ever split a module into its own service.
 */
export type DomainEventMap = {
  'user.verified': { userId: string; email: string };
  'user.deleted': { userId: string };
  'student-profile.updated': { userId: string; changedFields: string[] };
  'student-profile.onboarding-completed': { userId: string; completedAt: string };
  'roadmap.generated': { userId: string; roadmapId: string; source: string };
  'roadmap.item.completed': { userId: string; roadmapId: string; itemId: string };
  'assignment.generated': { userId: string; assignmentId: string };
  'assignment.completed': { userId: string; assignmentId: string; score: number };
  'live-session.started': { sessionId: string; mentorId: string };
  'live-session.ended': { sessionId: string; mentorId: string };
};

type EventName = keyof DomainEventMap;

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function on<E extends EventName>(
  event: E,
  handler: (payload: DomainEventMap[E]) => void | Promise<void>,
): void {
  emitter.on(event, (payload: DomainEventMap[E]) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err: unknown) => {
        logger.error({ err, event }, 'event handler failed');
      });
  });
}

export function emit<E extends EventName>(event: E, payload: DomainEventMap[E]): void {
  logger.debug({ event, payload }, 'domain event emitted');
  emitter.emit(event, payload);
}

export const events = { on, emit };
