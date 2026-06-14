import type { ResultSetHeader } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

export async function logRecommendationAck(input: {
  userId: string;
  recId: string;
  action: 'clicked' | 'dismissed';
}): Promise<void> {
  const clicked = input.action === 'clicked';
  await db.execute<ResultSetHeader>(
    'INSERT INTO `RecommendationLog` ' +
      '(`id`, `userId`, `source`, `recId`, `payload`, `shownIn`, `actedOn`, `actedAt`, `dismissedAt`) ' +
      'VALUES (:id, :userId, :source, :recId, :payload, :shownIn, :actedOn, :actedAt, :dismissedAt)',
    {
      id: createId(),
      userId: input.userId,
      source: 'default',
      recId: input.recId,
      payload: JSON.stringify({ action: input.action }),
      shownIn: 'dashboard.next-steps',
      actedOn: clicked,
      actedAt: clicked ? new Date() : null,
      dismissedAt: clicked ? null : new Date(),
    },
  );
}
