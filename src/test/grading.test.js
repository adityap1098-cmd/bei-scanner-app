// ─── FUNCTIONAL TESTS: Grading System ────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { getGrade, GRADE_MAP } from '../utils/grading.js';

describe('getGrade', () => {
  it('returns STRONG BUY for score >= 85', () => {
    expect(getGrade(85).label).toBe('STRONG BUY');
    expect(getGrade(100).label).toBe('STRONG BUY');
    expect(getGrade(90).label).toBe('STRONG BUY');
  });

  it('returns BUY for score 70–84', () => {
    expect(getGrade(70).label).toBe('BUY');
    expect(getGrade(84).label).toBe('BUY');
  });

  it('returns ACCUMULATE for score 55–69', () => {
    expect(getGrade(55).label).toBe('ACCUMULATE');
    expect(getGrade(69).label).toBe('ACCUMULATE');
  });

  it('returns HOLD for score 40–54', () => {
    expect(getGrade(40).label).toBe('HOLD');
    expect(getGrade(54).label).toBe('HOLD');
  });

  it('returns REDUCE for score 25–39', () => {
    expect(getGrade(25).label).toBe('REDUCE');
    expect(getGrade(39).label).toBe('REDUCE');
  });

  it('returns SELL / AVOID for score < 25', () => {
    expect(getGrade(0).label).toBe('SELL / AVOID');
    expect(getGrade(24).label).toBe('SELL / AVOID');
  });

  it('each grade has a color and icon', () => {
    for (const score of [0, 25, 40, 55, 70, 85]) {
      const g = getGrade(score);
      expect(g.color).toBeTruthy();
      expect(g.icon).toBeTruthy();
    }
  });

  it('boundary: score exactly at each threshold maps to correct grade', () => {
    const boundaries = [
      [85, 'STRONG BUY'],
      [70, 'BUY'],
      [55, 'ACCUMULATE'],
      [40, 'HOLD'],
      [25, 'REDUCE'],
      [0,  'SELL / AVOID'],
    ];
    boundaries.forEach(([score, label]) => {
      expect(getGrade(score).label).toBe(label);
    });
  });

  it('GRADE_MAP has 6 entries', () => {
    expect(GRADE_MAP).toHaveLength(6);
  });

  it('GRADE_MAP is ordered descending by min', () => {
    for (let i = 0; i < GRADE_MAP.length - 1; i++) {
      expect(GRADE_MAP[i].min).toBeGreaterThan(GRADE_MAP[i + 1].min);
    }
  });
});
