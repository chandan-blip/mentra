import { describe, expect, it } from 'vitest';
import type { RoadmapItemRow } from '../roadmap.repository.js';
import { RoadmapError } from '../roadmap.errors.js';
import { nextStatusFor } from '../transitions/item-transition.service.js';

type Status = RoadmapItemRow['status'];
const ALL: Status[] = ['locked', 'available', 'in_progress', 'completed', 'skipped'];

describe('nextStatusFor', () => {
  describe('start', () => {
    it('moves an available item to in_progress', () => {
      expect(nextStatusFor('start', 'available')).toBe('in_progress');
    });

    it.each(ALL.filter((s) => s !== 'available'))('rejects start from %s', (from) => {
      expect(() => nextStatusFor('start', from)).toThrow(RoadmapError);
    });
  });

  describe('complete', () => {
    it.each<Status>(['available', 'in_progress'])('completes from %s', (from) => {
      expect(nextStatusFor('complete', from)).toBe('completed');
    });

    it.each<Status>(['locked', 'completed', 'skipped'])('rejects complete from %s', (from) => {
      expect(() => nextStatusFor('complete', from)).toThrow(RoadmapError);
    });
  });

  it('throws a 409 with a descriptive code on invalid transitions', () => {
    try {
      nextStatusFor('complete', 'locked');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RoadmapError);
      expect((err as RoadmapError).status).toBe(409);
      expect((err as RoadmapError).code).toBe('INVALID_TRANSITION');
    }
  });
});
