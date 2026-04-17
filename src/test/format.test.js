// ─── FUNCTIONAL TESTS: Formatting Utilities ───────────────────────────────────
import { describe, it, expect } from 'vitest';
import { nf, fmt, fmtDec } from '../utils/format.js';

describe('nf (parse number with fallback)', () => {
  it('parses valid number string', () => {
    expect(nf('3.14')).toBe(3.14);
  });

  it('parses integer string', () => {
    expect(nf('42')).toBe(42);
  });

  it('returns 0 (default fallback) for NaN input', () => {
    expect(nf('abc')).toBe(0);
    expect(nf(undefined)).toBe(0);
    expect(nf(null)).toBe(0);
  });

  it('returns custom fallback for NaN input', () => {
    expect(nf('bad', -1)).toBe(-1);
  });

  it('passes through numeric values unchanged', () => {
    expect(nf(99.9)).toBe(99.9);
  });

  it('handles negative numbers', () => {
    expect(nf('-5.5')).toBe(-5.5);
  });

  it('handles zero string', () => {
    expect(nf('0')).toBe(0);
  });
});

describe('fmt (integer formatter, Indonesian locale)', () => {
  it('formats 1000 with thousand separator', () => {
    // Indonesian locale uses "." as thousands separator
    expect(fmt(1000)).toMatch(/1[\.,]000/);
  });

  it('rounds to integer', () => {
    // Should not contain decimal point beyond thousands separator
    const result = fmt(1234.567);
    // The number part should be 1235 rounded
    expect(result).toMatch(/1[\.,]235/);
  });

  it('handles null/undefined with 0 fallback', () => {
    expect(fmt(null)).toBe('0');
    expect(fmt(undefined)).toBe('0');
  });

  it('handles 0', () => {
    expect(fmt(0)).toBe('0');
  });

  it('handles negative numbers', () => {
    const result = fmt(-1000);
    expect(result).toContain('1');
  });
});

describe('fmtDec (decimal formatter)', () => {
  it('formats to 2 decimal places by default', () => {
    expect(fmtDec(3.14159)).toBe('3.14');
  });

  it('formats to custom decimal places', () => {
    expect(fmtDec(3.14159, 4)).toBe('3.1416');
  });

  it('pads with zeros for fewer decimals than requested', () => {
    expect(fmtDec(3, 2)).toBe('3.00');
  });

  it('returns fallback 0 for NaN, formatted', () => {
    expect(fmtDec('bad')).toBe('0.00');
  });

  it('handles negative values', () => {
    expect(fmtDec(-1.5)).toBe('-1.50');
  });
});
