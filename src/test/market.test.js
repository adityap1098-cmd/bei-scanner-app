// ─── FUNCTIONAL TESTS: Market Status ─────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { getMarketStatus } from '../utils/market.js';

// Helper: create a UTC Date that arrives at a specific WIB time on a given weekday.
// WIB = UTC+7, so WIB time = UTC + 7h  →  UTC = WIB - 7h
function wibDate(dayUTC, wibH, wibM = 0) {
  // dayUTC: 0=Sun,1=Mon,...,6=Sat
  // We create a Monday base and adjust by day offset
  const base = new Date('2024-01-01T00:00:00Z'); // Monday Jan 1
  const dayOffset = (dayUTC - 1 + 7) % 7;        // days from Monday
  const utcH = wibH - 7;
  return new Date(base.getTime() + dayOffset * 86400_000 + utcH * 3600_000 + wibM * 60_000);
}

describe('getMarketStatus — weekend', () => {
  it('returns TUTUP on Sunday', () => {
    const s = getMarketStatus(wibDate(0, 12, 0));
    expect(s.label).toBe('TUTUP');
    expect(s.open).toBe(false);
    expect(s.sub).toBe('Weekend');
  });

  it('returns TUTUP on Saturday', () => {
    const s = getMarketStatus(wibDate(6, 10, 0));
    expect(s.label).toBe('TUTUP');
    expect(s.open).toBe(false);
  });
});

describe('getMarketStatus — weekday sessions (Monday)', () => {
  const MON = 1;

  it('returns TUTUP before PRE-OPEN (08:00 WIB)', () => {
    const s = getMarketStatus(wibDate(MON, 8, 0));
    expect(s.label).toBe('TUTUP');
    expect(s.open).toBe(false);
  });

  it('returns PRE-OPEN at 08:45 WIB', () => {
    const s = getMarketStatus(wibDate(MON, 8, 45));
    expect(s.label).toBe('PRE-OPEN');
    expect(s.open).toBe(false);
  });

  it('returns SESI 1 at 09:00 WIB', () => {
    const s = getMarketStatus(wibDate(MON, 9, 0));
    expect(s.label).toBe('SESI 1');
    expect(s.open).toBe(true);
  });

  it('returns SESI 1 at 11:59 WIB (Mon)', () => {
    const s = getMarketStatus(wibDate(MON, 11, 59));
    expect(s.label).toBe('SESI 1');
    expect(s.open).toBe(true);
  });

  it('returns ISTIRAHAT at 12:00 WIB (Mon)', () => {
    const s = getMarketStatus(wibDate(MON, 12, 0));
    expect(s.label).toBe('ISTIRAHAT');
    expect(s.open).toBe(false);
  });

  it('returns SESI 2 at 13:30 WIB (Mon)', () => {
    const s = getMarketStatus(wibDate(MON, 13, 30));
    expect(s.label).toBe('SESI 2');
    expect(s.open).toBe(true);
  });

  it('returns SESI 2 at 15:48 WIB', () => {
    const s = getMarketStatus(wibDate(MON, 15, 48));
    expect(s.label).toBe('SESI 2');
    expect(s.open).toBe(true);
  });

  it('returns POST-CLOSE at 15:49 WIB', () => {
    const s = getMarketStatus(wibDate(MON, 15, 49));
    expect(s.label).toBe('POST-CLOSE');
    expect(s.open).toBe(false);
  });

  it('returns TUTUP after 16:00 WIB', () => {
    const s = getMarketStatus(wibDate(MON, 16, 1));
    expect(s.label).toBe('TUTUP');
    expect(s.open).toBe(false);
  });
});

describe('getMarketStatus — Friday short session', () => {
  const FRI = 5;

  it('returns SESI 1 at 09:30 WIB on Friday', () => {
    const s = getMarketStatus(wibDate(FRI, 9, 30));
    expect(s.label).toBe('SESI 1');
    expect(s.open).toBe(true);
    expect(s.sub).toBe('09:00–11:30');
  });

  it('returns ISTIRAHAT at 11:30 WIB on Friday', () => {
    const s = getMarketStatus(wibDate(FRI, 11, 30));
    expect(s.label).toBe('ISTIRAHAT');
    expect(s.open).toBe(false);
  });

  it('returns SESI 2 at 14:00 WIB on Friday', () => {
    const s = getMarketStatus(wibDate(FRI, 14, 0));
    expect(s.label).toBe('SESI 2');
    expect(s.open).toBe(true);
    expect(s.sub).toBe('14:00–15:49');
  });
});

describe('getMarketStatus — return shape', () => {
  it('always returns open, label, color, sub', () => {
    const s = getMarketStatus(wibDate(1, 10, 0));
    expect(s).toHaveProperty('open');
    expect(s).toHaveProperty('label');
    expect(s).toHaveProperty('color');
    expect(s).toHaveProperty('sub');
  });

  it('color is a hex string', () => {
    const s = getMarketStatus(wibDate(1, 10, 0));
    expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
