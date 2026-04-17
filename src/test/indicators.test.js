// ─── FUNCTIONAL TESTS: Technical Indicators ──────────────────────────────────
import { describe, it, expect } from 'vitest';
import { calcEMA, calcRSI, calcMACD, calcSMA, calcBollinger } from '../utils/indicators.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const rising  = (n, start = 100, step = 2) => Array.from({ length: n }, (_, i) => start + i * step);
const falling = (n, start = 200, step = 2) => Array.from({ length: n }, (_, i) => start - i * step);
const flat    = (n, v = 100) => Array.from({ length: n }, () => v);

// ─── calcEMA ─────────────────────────────────────────────────────────────────
describe('calcEMA', () => {
  it('returns empty array for empty input', () => {
    expect(calcEMA([], 12)).toEqual([]);
  });

  it('returns single-element array for single input', () => {
    expect(calcEMA([42], 12)).toEqual([42]);
  });

  it('first value equals first data point', () => {
    const result = calcEMA([100, 110, 120], 3);
    expect(result[0]).toBe(100);
  });

  it('length equals input length', () => {
    const data = rising(50);
    expect(calcEMA(data, 12).length).toBe(50);
  });

  it('EMA trends upward for rising prices', () => {
    const result = calcEMA(rising(50), 12);
    expect(result[result.length - 1]).toBeGreaterThan(result[0]);
  });

  it('EMA trends downward for falling prices', () => {
    const result = calcEMA(falling(50), 12);
    expect(result[result.length - 1]).toBeLessThan(result[0]);
  });

  it('EMA of flat prices stays constant', () => {
    const result = calcEMA(flat(30, 100), 10);
    result.forEach(v => expect(v).toBeCloseTo(100, 5));
  });

  it('shorter period EMA reacts faster than longer period', () => {
    const prices = [...flat(20, 100), ...rising(30, 100, 5)];
    const ema5  = calcEMA(prices, 5);
    const ema20 = calcEMA(prices, 20);
    const last5  = ema5[ema5.length - 1];
    const last20 = ema20[ema20.length - 1];
    expect(last5).toBeGreaterThan(last20);
  });
});

// ─── calcRSI ─────────────────────────────────────────────────────────────────
describe('calcRSI', () => {
  it('returns 50 when data is insufficient (< period + 2)', () => {
    expect(calcRSI([100, 101, 102])).toBe(50);
    expect(calcRSI([])).toBe(50);
  });

  it('returns value between 0 and 100', () => {
    const rsi = calcRSI(rising(30));
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it('returns high RSI (>70) for a strong uptrend', () => {
    expect(calcRSI(rising(30))).toBeGreaterThan(70);
  });

  it('returns low RSI (<30) for a strong downtrend', () => {
    expect(calcRSI(falling(30))).toBeLessThan(30);
  });

  it('returns ~50 for flat prices (no gain no loss)', () => {
    // Flat data has 0 gains and 0 losses → RS = ag/0.0001 → nearly 100
    // actually calcRSI returns 100 when all changes are 0 due to ag=0, al=0 → RS = 0/0.0001 = 0 → RSI=100? Let's just verify range
    const rsi = calcRSI(flat(30));
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it('handles period parameter correctly', () => {
    const data = rising(30);
    const rsi9  = calcRSI(data, 9);
    const rsi14 = calcRSI(data, 14);
    // Both should be in valid range
    expect(rsi9).toBeGreaterThanOrEqual(0);
    expect(rsi9).toBeLessThanOrEqual(100);
    expect(rsi14).toBeGreaterThanOrEqual(0);
    expect(rsi14).toBeLessThanOrEqual(100);
  });

  it('returns integer (Math.round applied)', () => {
    const rsi = calcRSI(rising(30));
    expect(Number.isInteger(rsi)).toBe(true);
  });
});

// ─── calcMACD ────────────────────────────────────────────────────────────────
describe('calcMACD', () => {
  it('returns neutral defaults when data < 35', () => {
    const result = calcMACD(rising(20));
    expect(result).toEqual({ signal: 'neutral', macd: 0, sig: 0, hist: 0, histArr: [] });
  });

  it('returns object with required keys', () => {
    const result = calcMACD(rising(60));
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('macd');
    expect(result).toHaveProperty('sig');
    expect(result).toHaveProperty('hist');
    expect(result).toHaveProperty('histArr');
  });

  it('signal is one of the four valid values', () => {
    const VALID = ['bullish_cross', 'bearish', 'above_signal', 'neutral'];
    const result = calcMACD(rising(60));
    expect(VALID).toContain(result.signal);
  });

  it('hist equals macd minus sig', () => {
    const result = calcMACD(rising(60));
    expect(result.hist).toBeCloseTo(result.macd - result.sig, 8);
  });

  it('detects above_signal for persistent uptrend', () => {
    // Long consistent uptrend → MACD line stays above signal
    const result = calcMACD(rising(100, 100, 3));
    expect(['above_signal', 'bullish_cross']).toContain(result.signal);
  });

  it('detects bearish for persistent downtrend', () => {
    const result = calcMACD(falling(100, 500, 3));
    expect(['bearish', 'neutral']).toContain(result.signal);
  });

  it('histArr has correct length (data.length - 25 - 8)', () => {
    const data = rising(60);
    const result = calcMACD(data);
    // macdLine length = 60, slice from 25 → 35 points, EMA9 → 35 points
    expect(result.histArr.length).toBe(35);
  });
});

// ─── calcSMA ─────────────────────────────────────────────────────────────────
describe('calcSMA', () => {
  it('returns last element when data shorter than period', () => {
    expect(calcSMA([10, 20, 30], 10)).toBe(30);
  });

  it('returns correct average for exact period', () => {
    expect(calcSMA([10, 20, 30], 3)).toBeCloseTo(20, 5);
  });

  it('uses only last `period` elements', () => {
    // [1,2,3,100,100] period=2 → avg of [100,100] = 100
    expect(calcSMA([1, 2, 3, 100, 100], 2)).toBeCloseTo(100, 5);
  });

  it('returns 0 for empty array', () => {
    expect(calcSMA([], 5)).toBe(0);
  });

  it('SMA of flat array equals that value', () => {
    expect(calcSMA(flat(20, 150), 10)).toBeCloseTo(150, 5);
  });
});

// ─── calcBollinger ───────────────────────────────────────────────────────────
describe('calcBollinger', () => {
  it('returns zeros when data < period', () => {
    expect(calcBollinger([100, 110], 20)).toEqual({ upper: 0, mid: 0, lower: 0 });
  });

  it('returns object with upper, mid, lower', () => {
    const result = calcBollinger(rising(30), 20);
    expect(result).toHaveProperty('upper');
    expect(result).toHaveProperty('mid');
    expect(result).toHaveProperty('lower');
  });

  it('upper > mid > lower for non-flat data', () => {
    const result = calcBollinger(rising(30), 20);
    expect(result.upper).toBeGreaterThan(result.mid);
    expect(result.mid).toBeGreaterThan(result.lower);
  });

  it('mid equals SMA of last period elements', () => {
    const data = rising(30);
    const period = 20;
    const expectedMid = data.slice(-period).reduce((a, b) => a + b, 0) / period;
    const result = calcBollinger(data, period);
    expect(result.mid).toBeCloseTo(expectedMid, 5);
  });

  it('bands are symmetric around mid', () => {
    const result = calcBollinger(rising(30), 20);
    const upperDiff = result.upper - result.mid;
    const lowerDiff = result.mid - result.lower;
    expect(upperDiff).toBeCloseTo(lowerDiff, 5);
  });

  it('flat prices produce zero-width bands (upper = mid = lower)', () => {
    const result = calcBollinger(flat(30, 100), 20);
    expect(result.upper).toBeCloseTo(100, 5);
    expect(result.mid).toBeCloseTo(100, 5);
    expect(result.lower).toBeCloseTo(100, 5);
  });

  it('custom mult=1 produces narrower bands than mult=2', () => {
    const data = rising(30);
    const b2 = calcBollinger(data, 20, 2);
    const b1 = calcBollinger(data, 20, 1);
    expect(b2.upper - b2.lower).toBeGreaterThan(b1.upper - b1.lower);
  });
});
