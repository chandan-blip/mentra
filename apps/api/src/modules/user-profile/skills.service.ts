import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SkillCatalogueEntry } from '@mentra/shared';
import { logger } from '../../logger.js';

const here = dirname(fileURLToPath(import.meta.url));

function loadCatalogue(): SkillCatalogueEntry[] {
  try {
    const raw = readFileSync(join(here, 'data', 'skill-catalogue.json'), 'utf8');
    return JSON.parse(raw) as SkillCatalogueEntry[];
  } catch (err) {
    logger.error({ err }, 'failed to load skill catalogue');
    return [];
  }
}

const catalogue = loadCatalogue();
const byId = new Map(catalogue.map((entry) => [entry.id, entry]));

logger.info({ count: catalogue.length }, 'skill catalogue loaded');

export function searchSkills(query: string | undefined, limit = 20): SkillCatalogueEntry[] {
  const q = query?.trim().toLowerCase();
  if (!q) return catalogue.slice(0, limit);
  const matches = catalogue.filter(
    (entry) => entry.id.includes(q) || entry.label.toLowerCase().includes(q),
  );
  // Prefer prefix matches, then by label length (shorter = more relevant).
  matches.sort((a, b) => {
    const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.label.length - b.label.length;
  });
  return matches.slice(0, limit);
}

export function isValidSkillId(id: string): boolean {
  return byId.has(id);
}

export function unknownSkillIds(ids: string[]): string[] {
  return ids.filter((id) => !byId.has(id));
}
