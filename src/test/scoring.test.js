// ─── FUNCTIONAL TESTS: Scoring Engine ────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { calcScores, SECTOR_DATA } from '../utils/scoring.js';

// Base "neutral" stock data — scores should land somewhere in the middle
const baseData = {
  roe: 12, pe: 12, pbv: 0.96, der: 0.8, epsGrowth: 10,
  rsi: 40, macdSignal: 'neutral',
  ma20Above50: true, currentPrice: 1000, ma50: 950, currentOpen: 990,
  volumeBreakout: false, avgVol20: 1_000_000, todayVol: 1_200_000,
  high52w: 1500, boll_lower: 920,
  tvAdvice: null,
};

describe('calcScores — return shape', () => {
  it('returns fund, tech, band, comp', () => {
    const s = calcScores(baseData, 'Industrials');
    expect(s).toHaveProperty('fund');
    expect(s).toHaveProperty('tech');
    expect(s).toHaveProperty('band');
    expect(s).toHaveProperty('comp');
  });

  it('all scores are between 0 and 100', () => {
    const s = calcScores(baseData, 'Industrials');
    for (const key of ['fund', 'tech', 'band', 'comp']) {
      expect(s[key]).toBeGreaterThanOrEqual(0);
      expect(s[key]).toBeLessThanOrEqual(100);
    }
  });

  it('comp is a rounded integer', () => {
    const s = calcScores(baseData, 'Industrials');
    expect(Number.isInteger(s.comp)).toBe(true);
  });
});

describe('calcScores — fundamental (fund)', () => {
  it('higher ROE gives higher fund score', () => {
    const low  = calcScores({ ...baseData, roe: 2  }, 'Industrials');
    const high = calcScores({ ...baseData, roe: 25 }, 'Industrials');
    expect(high.fund).toBeGreaterThan(low.fund);
  });

  it('lower PBV relative to sector gives higher fund score', () => {
    const cheap    = calcScores({ ...baseData, pbv: 0.5  }, 'Industrials'); // << sector avg 0.96
    const expensive= calcScores({ ...baseData, pbv: 2.0  }, 'Industrials'); // >> sector avg
    expect(cheap.fund).toBeGreaterThan(expensive.fund);
  });

  it('lower PE relative to sector gives higher fund score', () => {
    const cheap    = calcScores({ ...baseData, pe: 5   }, 'Industrials'); // < sector avg 12.86
    const expensive= calcScores({ ...baseData, pe: 30  }, 'Industrials');
    expect(cheap.fund).toBeGreaterThan(expensive.fund);
  });

  it('lower DER gives higher fund score', () => {
    const low  = calcScores({ ...baseData, der: 0.3 }, 'Industrials');
    const high = calcScores({ ...baseData, der: 2.5 }, 'Industrials');
    expect(low.fund).toBeGreaterThan(high.fund);
  });

  it('higher EPS growth gives higher fund score', () => {
    const low  = calcScores({ ...baseData, epsGrowth: -5  }, 'Industrials');
    const high = calcScores({ ...baseData, epsGrowth: 30  }, 'Industrials');
    expect(high.fund).toBeGreaterThan(low.fund);
  });
});

describe('calcScores — technical (tech)', () => {
  it('RSI 25–45 (sweet spot) gives higher tech than RSI > 70', () => {
    const sweet     = calcScores({ ...baseData, rsi: 35 }, 'Industrials');
    const overbought= calcScores({ ...baseData, rsi: 75 }, 'Industrials');
    expect(sweet.tech).toBeGreaterThan(overbought.tech);
  });

  it('bullish_cross MACD gives higher tech than bearish', () => {
    const bull = calcScores({ ...baseData, macdSignal: 'bullish_cross' }, 'Industrials');
    const bear = calcScores({ ...baseData, macdSignal: 'bearish'       }, 'Industrials');
    expect(bull.tech).toBeGreaterThan(bear.tech);
  });

  it('golden cross + price above MA50 adds bonus', () => {
    const golden = calcScores({ ...baseData, ma20Above50: true,  currentPrice: 1000, ma50: 900 }, 'Industrials');
    const death  = calcScores({ ...baseData, ma20Above50: false, currentPrice: 800,  ma50: 900 }, 'Industrials');
    expect(golden.tech).toBeGreaterThan(death.tech);
  });

  it('STRONG BUY tvAdvice boosts tech', () => {
    const withAdvice    = calcScores({ ...baseData, tvAdvice: { swing: 'STRONG BUY' } }, 'Industrials');
    const withoutAdvice = calcScores({ ...baseData, tvAdvice: null                    }, 'Industrials');
    expect(withAdvice.tech).toBeGreaterThan(withoutAdvice.tech);
  });

  it('STRONG SELL tvAdvice penalizes tech', () => {
    const sell    = calcScores({ ...baseData, tvAdvice: { swing: 'STRONG SELL' } }, 'Industrials');
    const neutral = calcScores({ ...baseData, tvAdvice: null                    }, 'Industrials');
    expect(sell.tech).toBeLessThan(neutral.tech);
  });
});

describe('calcScores — bandarmologi (band)', () => {
  it('price far below 52w high gives higher band score', () => {
    const deep = calcScores({ ...baseData, currentPrice: 500, high52w: 1500 }, 'Industrials'); // 33% of 52wH
    const near = calcScores({ ...baseData, currentPrice: 1400, high52w: 1500}, 'Industrials'); // 93% of 52wH
    expect(deep.band).toBeGreaterThan(near.band);
  });

  it('price near lower bollinger band adds band score', () => {
    const nearSupport = calcScores({ ...baseData, currentPrice: 930, boll_lower: 920 }, 'Industrials');
    const farSupport  = calcScores({ ...baseData, currentPrice: 1200, boll_lower: 920}, 'Industrials');
    expect(nearSupport.band).toBeGreaterThan(farSupport.band);
  });

  it('volume > 2x average gives highest band score', () => {
    const spike  = calcScores({ ...baseData, todayVol: 3_000_000, avgVol20: 1_000_000 }, 'Industrials');
    const normal = calcScores({ ...baseData, todayVol:   800_000, avgVol20: 1_000_000 }, 'Industrials');
    expect(spike.band).toBeGreaterThan(normal.band);
  });
});

describe('calcScores — sector fallback', () => {
  it('falls back to Industrials for unknown sector', () => {
    const unknown = calcScores(baseData, 'UnknownSector');
    const indust  = calcScores(baseData, 'Industrials');
    expect(unknown).toEqual(indust);
  });

  it('all defined sectors produce valid scores', () => {
    for (const sector of Object.keys(SECTOR_DATA)) {
      const s = calcScores(baseData, sector);
      expect(s.fund).toBeGreaterThanOrEqual(0);
      expect(s.fund).toBeLessThanOrEqual(100);
    }
  });
});

describe('calcScores — composite weighting', () => {
  it('comp = 0.45*fund + 0.30*tech + 0.25*band (rounded)', () => {
    const s = calcScores(baseData, 'Industrials');
    const expected = Math.round(s.fund * 0.45 + s.tech * 0.30 + s.band * 0.25);
    expect(s.comp).toBe(expected);
  });
});
