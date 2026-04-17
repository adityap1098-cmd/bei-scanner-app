// ─── SECTOR BENCHMARKS ────────────────────────────────────────────────────────

export const SECTOR_DATA = {
  "Energi":                 { pe: 6.02,  pbv: 1.11, der: 0.82, color: "#f97316" },
  "Material Dasar":         { pe: 10.73, pbv: 1.20, der: 0.81, color: "#a78bfa" },
  "Industrials":            { pe: 12.86, pbv: 0.96, der: 0.70, color: "#38bdf8" },
  "Konsumer Non-Siklikal":  { pe: 14.55, pbv: 1.78, der: 0.84, color: "#34d399" },
  "Konsumer Siklikal":      { pe: 12.03, pbv: 1.03, der: 0.54, color: "#f472b6" },
  "Keuangan / Perbankan":   { pe: 9.50,  pbv: 1.40, der: 3.50, color: "#60a5fa" },
  "Teknologi":              { pe: 22.00, pbv: 3.20, der: 0.45, color: "#f9a8d4" },
  "Properti":               { pe: 11.00, pbv: 0.80, der: 0.90, color: "#86efac" },
  "Kesehatan":              { pe: 18.00, pbv: 2.10, der: 0.60, color: "#fde68a" },
  "Telekomunikasi":         { pe: 16.00, pbv: 2.50, der: 1.20, color: "#5eead4" },
};

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────

export function calcScores(d, sector) {
  const ref = SECTOR_DATA[sector] || SECTOR_DATA["Industrials"];
  let f = 0, t = 0, b = 0;

  if (d.roe >= 20) f += 25; else if (d.roe >= 12) f += 18; else if (d.roe >= 6) f += 10; else f += 2;
  const pbvD = (ref.pbv - d.pbv) / ref.pbv;
  if (pbvD > 0.2) f += 25; else if (pbvD > 0) f += 16; else if (pbvD > -0.2) f += 8; else f += 1;
  const peD = (ref.pe - d.pe) / ref.pe;
  if (peD > 0.2) f += 25; else if (peD > 0) f += 16; else if (peD > -0.2) f += 8; else f += 1;
  if (d.der < 0.5) f += 15; else if (d.der < 1.0) f += 11; else if (d.der < 1.5) f += 6; else f += 1;
  if (d.epsGrowth >= 20) f += 10; else if (d.epsGrowth >= 10) f += 7; else if (d.epsGrowth >= 0) f += 4;

  if (d.rsi >= 25 && d.rsi <= 45) t += 35;
  else if (d.rsi > 45 && d.rsi <= 60) t += 22;
  else if (d.rsi > 60 && d.rsi <= 70) t += 12;
  else if (d.rsi < 25) t += 16; else t += 3;
  t += ({ bullish_cross: 30, above_signal: 18, neutral: 10, bearish: 2 })[d.macdSignal] ?? 10;
  t += (d.ma20Above50 && d.currentPrice > d.ma50) ? 20 : (d.ma20Above50 ? 8 : 4);
  const greenVol = d.currentPrice >= d.currentOpen;
  t += (d.volumeBreakout && greenVol) ? 15 : 5;
  if (d.volumeBreakout && !greenVol) t -= 15;

  if (d.tvAdvice) {
    const advice = d.tvAdvice.swing || "";
    if (advice.includes("STRONG BUY")) t += 15;
    else if (advice.includes("BUY")) t += 8;
    else if (advice.includes("STRONG SELL")) t -= 25;
    else if (advice.includes("SELL")) t -= 12;
  }

  const priceVs52wH = d.high52w > 0 ? (d.currentPrice / d.high52w) * 100 : 50;
  if (priceVs52wH < 60) b += 30; else if (priceVs52wH < 75) b += 20; else if (priceVs52wH < 90) b += 12; else b += 5;
  const nearSupport = d.currentPrice <= d.boll_lower * 1.02;
  b += nearSupport ? 30 : 10;
  const volRatio = d.avgVol20 > 0 ? d.todayVol / d.avgVol20 : 1;
  if (volRatio > 2) b += 40; else if (volRatio > 1.5) b += 28; else if (volRatio > 1) b += 18; else b += 8;

  return {
    fund: Math.min(100, f),
    tech: Math.min(100, t),
    band: Math.min(100, b),
    comp: Math.round(Math.min(100, f) * 0.45 + Math.min(100, t) * 0.30 + Math.min(100, b) * 0.25)
  };
}
