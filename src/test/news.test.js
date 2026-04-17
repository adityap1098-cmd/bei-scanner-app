// ─── FUNCTIONAL TESTS: News Source Meta ──────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { getSourceMeta, SOURCE_META } from '../utils/news.js';

describe('getSourceMeta', () => {
  it('returns fallback for null/undefined publisher', () => {
    expect(getSourceMeta(null)).toEqual({ color: '#94a3b8', flag: '🌐' });
    expect(getSourceMeta(undefined)).toEqual({ color: '#94a3b8', flag: '🌐' });
    expect(getSourceMeta('')).toEqual({ color: '#94a3b8', flag: '🌐' });
  });

  it('matches known Indonesian sources (exact key)', () => {
    expect(getSourceMeta('Kontan').flag).toBe('🇮🇩');
    expect(getSourceMeta('Bisnis.com').flag).toBe('🇮🇩');
    expect(getSourceMeta('CNBC Indonesia').flag).toBe('🇮🇩');
    expect(getSourceMeta('Detik').flag).toBe('🇮🇩');
  });

  it('matches known global sources', () => {
    expect(getSourceMeta('Yahoo Finance').flag).toBe('🌐');
    expect(getSourceMeta('Bloomberg').flag).toBe('🌐');
    expect(getSourceMeta('Reuters').flag).toBe('🌐');
  });

  it('is case-insensitive for key matching', () => {
    expect(getSourceMeta('kontan').flag).toBe('🇮🇩');
    expect(getSourceMeta('BLOOMBERG').flag).toBe('🌐');
  });

  it('partial match works (publisher contains key)', () => {
    expect(getSourceMeta('kontan.co.id').flag).toBe('🇮🇩');
    expect(getSourceMeta('Bloomberg LP').flag).toBe('🌐');
  });

  it('detects .co.id domain as Indonesian', () => {
    expect(getSourceMeta('somesite.co.id').flag).toBe('🇮🇩');
  });

  it('detects .id TLD as Indonesian', () => {
    expect(getSourceMeta('berita.id').flag).toBe('🇮🇩');
  });

  it('detects "indonesia" in name as Indonesian', () => {
    expect(getSourceMeta('Media Indonesia').flag).toBe('🇮🇩');
  });

  it('returns global fallback for unknown foreign source', () => {
    const result = getSourceMeta('The Wall Street Journal');
    expect(result).toEqual({ color: '#94a3b8', flag: '🌐' });
  });

  it('returned color is a non-empty string', () => {
    for (const publisher of ['Kontan', 'Yahoo Finance', 'unknown.com']) {
      expect(getSourceMeta(publisher).color).toBeTruthy();
    }
  });

  it('each key in SOURCE_META produces its defined color', () => {
    for (const [key, meta] of Object.entries(SOURCE_META)) {
      expect(getSourceMeta(key).color).toBe(meta.color);
    }
  });
});
