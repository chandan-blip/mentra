import { randomUUID } from 'node:crypto';

/** Compact, URL-safe id matching the existing auth-module convention. */
export function createId(): string {
  return randomUUID().replaceAll('-', '');
}
