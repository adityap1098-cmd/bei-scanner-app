// ─── TECHNICAL INDICATORS ─────────────────────────────────────────────────────

export function calcEMA(data, period) {
  if (!data || data.length < 1) return [];
  const k = 2 / (period + 1);
  const res = [data[0]];
  for (let i = 1; i < data.length; i++) res.push(data[i] * k + res[i - 1] * (1 - k));
  return res;
}

export function calcRSI(closes, period = 14) {
  if (closes.length < period + 2) return 50;
  const changes = closes.slice(1).map((v, i) => v - closes[i]);
  let ag = 0, al = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) ag += changes[i]; else al += Math.abs(changes[i]);
  }
  ag /= period; al /= period;
  for (let i = period; i < changes.length; i++) {
    ag = (ag * (period - 1) + Math.max(changes[i], 0)) / period;
    al = (al * (period - 1) + Math.abs(Math.min(changes[i], 0))) / period;
  }
  const rs = ag / (al || 0.0001);
  return Math.round(100 - 100 / (1 + rs));
}

export function calcMACD(closes) {
  if (closes.length < 35) return { signal: "neutral", macd: 0, sig: 0, hist: 0, histArr: [] };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const sigLine = calcEMA(macdLine.slice(25), 9);
  const n = macdLine.length - 1;
  const lm = macdLine[n], pm = macdLine[n - 1];
  const ls = sigLine[sigLine.length - 1], ps = sigLine[sigLine.length - 2] ?? ls;
  let signal = "neutral";
  if (pm <= ps && lm > ls) signal = "bullish_cross";
  else if (pm >= ps && lm < ls) signal = "bearish";
  else if (lm > ls) signal = "above_signal";
  return { signal, macd: lm, sig: ls, hist: lm - ls, histArr: sigLine.map((_, i) => macdLine[i + 25] - sigLine[i]) };
}

export function calcSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function calcBollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return { upper: 0, mid: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.map(v => (v - mid) ** 2).reduce((a, b) => a + b, 0) / period);
  return { upper: mid + mult * std, mid, lower: mid - mult * std };
}
