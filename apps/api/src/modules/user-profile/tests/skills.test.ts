import { describe, expect, it } from 'vitest';
import { isValidSkillId, searchSkills, unknownSkillIds } from '../skills.service.js';

describe('skills catalogue', () => {
  it('loads a non-empty catalogue', () => {
    expect(searchSkills(undefined).length).toBeGreaterThan(0);
  });

  it('finds react by query and prefers prefix matches', () => {
    const results = searchSkills('react');
    expect(results.some((r) => r.id === 'react')).toBe(true);
    expect(results[0]?.label.toLowerCase().startsWith('react')).toBe(true);
  });

  it('matches on label case-insensitively', () => {
    expect(searchSkills('TYPESCRIPT').some((r) => r.id === 'typescript')).toBe(true);
  });

  it('validates known and unknown skill ids', () => {
    expect(isValidSkillId('javascript')).toBe(true);
    expect(isValidSkillId('not-a-real-skill')).toBe(false);
    expect(unknownSkillIds(['react', 'bogus', 'node'])).toEqual(['bogus', 'node']);
  });
});
