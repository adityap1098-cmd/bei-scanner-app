import { useState, useEffect, useRef, useCallback } from "react";

// ─── SECTOR BENCHMARKS (BEI) ──────────────────────────────────────────────────
const SECTOR_DATA = {
  "Energi": { pe: 6.02, pbv: 1.11, der: 0.82, color: "#f97316" },
  "Material Dasar": { pe: 10.73, pbv: 1.20, der: 0.81, color: "#a78bfa" },
  "Industrials": { pe: 12.86, pbv: 0.96, der: 0.70, color: "#38bdf8" },
  "Konsumer Non-Siklikal": { pe: 14.55, pbv: 1.78, der: 0.84, color: "#34d399" },
  "Konsumer Siklikal": { pe: 12.03, pbv: 1.03, der: 0.54, color: "#f472b6" },
  "Keuangan / Perbankan": { pe: 9.50, pbv: 1.40, der: 3.50, color: "#60a5fa" },
  "Teknologi": { pe: 22.00, pbv: 3.20, der: 0.45, color: "#f9a8d4" },
  "Properti": { pe: 11.00, pbv: 0.80, der: 0.90, color: "#86efac" },
  "Kesehatan": { pe: 18.00, pbv: 2.10, der: 0.60, color: "#fde68a" },
  "Telekomunikasi": { pe: 16.00, pbv: 2.50, der: 1.20, color: "#5eead4" },
};

const GRADE_MAP = [
  { min: 85, label: "STRONG BUY", color: "#00ff88", icon: "▲▲▲" },
  { min: 70, label: "BUY", color: "#4ade80", icon: "▲▲" },
  { min: 55, label: "ACCUMULATE", color: "#fbbf24", icon: "▲" },
  { min: 40, label: "HOLD", color: "#94a3b8", icon: "—" },
  { min: 25, label: "REDUCE", color: "#fb923c", icon: "▼" },
  { min: 0, label: "SELL / AVOID", color: "#f87171", icon: "▼▼▼" },
];

const POPULAR = ["BBCA", "BBRI", "TLKM", "ASII", "GOTO", "BREN", "UNVR", "BMRI", "SMGR", "INDF", "ADRO", "KLBF", "CPIN", "ITMG", "ICBP"];
const CACHE_TTL = 15 * 60 * 1000;

const nf = (v, fb = 0) => { const x = parseFloat(v); return isNaN(x) ? fb : x; };
const fmt = v => Math.round(v ?? 0).toLocaleString("id-ID");
const fmtDec = (v, d = 2) => nf(v).toFixed(d);
const getGrade = s => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP.at(-1);

// ─── MARKET STATUS ────────────────────────────────────────────────────────────
function getMarketStatus() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const day = wib.getUTCDay();
  const h = wib.getUTCHours(), m = wib.getUTCMinutes();
  const t = h * 60 + m;
  const isFri = day === 5;
  if (day === 0 || day === 6) return { open: false, label: "TUTUP", color: "#f87171", sub: "Weekend" };
  if (t >= 8 * 60 + 45 && t < 9 * 60) return { open: false, label: "PRE-OPEN", color: "#fbbf24", sub: "08:45–09:00 WIB" };
  if (t >= 9 * 60 && t < (isFri ? 11 * 60 + 30 : 12 * 60))
    return { open: true, label: "SESI 1", color: "#00ff88", sub: isFri ? "09:00–11:30" : "09:00–12:00" };
  if (t >= (isFri ? 11 * 60 + 30 : 12 * 60) && t < (isFri ? 14 * 60 : 13 * 60 + 30))
    return { open: false, label: "ISTIRAHAT", color: "#94a3b8", sub: "Jeda siang" };
  if (t >= (isFri ? 14 * 60 : 13 * 60 + 30) && t < 15 * 60 + 49)
    return { open: true, label: "SESI 2", color: "#00ff88", sub: isFri ? "14:00–15:49" : "13:30–15:49" };
  if (t >= 15 * 60 + 49 && t < 16 * 60) return { open: false, label: "POST-CLOSE", color: "#94a3b8", sub: "Setelah close" };
  return { open: false, label: "TUTUP", color: "#f87171", sub: "Di luar jam trading" };
}

// ─── TECHNICAL INDICATORS ─────────────────────────────────────────────────────
function calcEMA(data, period) {
  if (!data || data.length < 1) return [];
  const k = 2 / (period + 1);
  const res = [data[0]];
  for (let i = 1; i < data.length; i++) res.push(data[i] * k + res[i - 1] * (1 - k));
  return res;
}

function calcRSI(closes, period = 14) {
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

function calcMACD(closes) {
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

function calcSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcBollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return { upper: 0, mid: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.map(v => (v - mid) ** 2).reduce((a, b) => a + b, 0) / period);
  return { upper: mid + mult * std, mid, lower: mid - mult * std };
}

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function calcScores(d, sector) {
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

// ─── YAHOO FINANCE FETCH ──────────────────────────────────────────────────────
async function fetchYF(url) {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${url}`,
    `https://cors.eu.org/${url}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url,
  ];
  let lastError = "Semua endpoint gagal";
  for (const u of proxies) {
    try {
      const r = await fetch(u, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) { lastError = `HTTP ${r.status}`; continue; }
      const txt = await r.text();
      let json;
      try { json = JSON.parse(txt); } catch (e) { lastError = "Invalid JSON"; continue; }
      if (u.includes('/get?url=') && json.contents) {
        try { json = JSON.parse(json.contents); } catch (e) { lastError = "Invalid JSON contents"; continue; }
      }
      if (json) return json;
    } catch (e) { lastError = e.message; }
  }
  throw new Error(`Semua endpoint gagal (${lastError})`);
}

// ─── NEWS MULTI-SOURCE ────────────────────────────────────────────────────────
const SOURCE_META = {
  "Kontan": { color: "#f97316", flag: "🇮🇩" },
  "Bisnis": { color: "#22c55e", flag: "🇮🇩" },
  "CNBC Indonesia": { color: "#3b82f6", flag: "🇮🇩" },
  "Detik": { color: "#ef4444", flag: "🇮🇩" },
  "Kompas": { color: "#dc2626", flag: "🇮🇩" },
  "Tempo": { color: "#8b5cf6", flag: "🇮🇩" },
  "CNN Indonesia": { color: "#b91c1c", flag: "🇮🇩" },
  "IDX": { color: "#f5c842", flag: "🇮🇩" },
  "Investor": { color: "#0ea5e9", flag: "🇮🇩" },
  "Market": { color: "#06b6d4", flag: "🇮🇩" },
  "Yahoo Finance": { color: "#6366f1", flag: "🌐" },
  "Bloomberg": { color: "#f59e0b", flag: "🌐" },
  "Reuters": { color: "#ff6600", flag: "🌐" },
};

function getSourceMeta(publisher) {
  if (!publisher) return { color: "#94a3b8", flag: "🌐" };
  for (const [key, meta] of Object.entries(SOURCE_META)) {
    if (publisher.toLowerCase().includes(key.toLowerCase())) return meta;
  }
  if (publisher.includes(".co.id") || publisher.toLowerCase().includes("indonesia") || publisher.endsWith(".id"))
    return { color: "#34d399", flag: "🇮🇩" };
  return { color: "#94a3b8", flag: "🌐" };
}

async function fetchRssNews(rssUrl, defaultPublisher) {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${rssUrl}`,
    `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
  ];
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) continue;
      const text = await r.text();
      if (!text.includes("<item") && !text.includes("<entry")) continue;
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const items = Array.from(xml.querySelectorAll("item, entry"));
      return items.slice(0, 8).map(item => {
        const title = (item.querySelector("title")?.textContent || "").trim().replace(/<!\[CDATA\[|\]\]>/g, "");
        const link = (item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href") || "#").trim();
        const pubDate = item.querySelector("pubDate, published, updated")?.textContent || "";
        const sourceEl = item.querySelector("source");
        const publisher = (sourceEl?.textContent?.trim() || defaultPublisher ||
          (() => { try { return new URL(link).hostname.replace("www.", ""); } catch { return ""; } })());
        const ts = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0;
        return { title, link, publisher, time: ts };
      }).filter(n => n.title && n.title.length > 5);
    } catch (_) { continue; }
  }
  return [];
}

async function fetchNewsHeadlines(ticker, companyName) {
  const cleanName = (companyName || ticker).replace(/\bTbk\.?\b/gi, "").replace(/\bPT\.?\b/gi, "").trim();
  const shortName = cleanName.split(" ").slice(0, 3).join(" ");

  const jobs = [
    // 1. Yahoo Finance (global, Inggris)
    (async () => {
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}.JK&newsCount=8&enableFuzzyQuery=false`;
        const raw = await fetchYF(url);
        return (raw?.news || []).slice(0, 5).map(n => ({
          title: n.title, publisher: n.publisher || "Yahoo Finance",
          time: n.providerPublishTime || 0, link: n.link || "#", lang: "en"
        }));
      } catch { return []; }
    })(),
    // 2. Google News RSS Indonesia — kode saham
    fetchRssNews(`https://news.google.com/rss/search?q=${encodeURIComponent(ticker + " saham")}&hl=id&gl=ID&ceid=ID:id`, "Google News ID"),
    // 3. Google News RSS Indonesia — nama perusahaan
    (shortName && shortName !== ticker)
      ? fetchRssNews(`https://news.google.com/rss/search?q=${encodeURIComponent(shortName)}&hl=id&gl=ID&ceid=ID:id`, "Google News ID")
      : Promise.resolve([]),
    // 4. Kontan — media finansial lokal #1
    fetchRssNews(`https://www.kontan.co.id/search/rss?search=${encodeURIComponent(ticker)}`, "Kontan"),
    // 5. Bisnis.com
    fetchRssNews(`https://www.bisnis.com/search?q=${encodeURIComponent(ticker)}&format=rss`, "Bisnis.com"),
  ];

  const results = await Promise.allSettled(jobs);
  const allNews = results.flatMap(r => r.status === "fulfilled" ? r.value : []);

  // Deduplicate by first 45 chars of title
  const seen = new Set();
  const unique = allNews.filter(n => {
    if (!n.title) return false;
    const key = n.title.slice(0, 45).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 12);
}

// ─── MAIN DATA FETCH ──────────────────────────────────────────────────────────
async function fetchStockRealtime(ticker) {
  const sym = `${ticker}.JK`;
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2y&includePrePost=false`;
  const chartRaw = await fetchYF(chartUrl);
  const result = chartRaw?.chart?.result?.[0];
  if (!result) throw new Error(`${sym} tidak ditemukan. Pastikan kode saham benar.`);

  const q = result.indicators.quote[0];
  const timestamps = result.timestamp || [];
  const validIdx = timestamps.map((_, i) => i).filter(i =>
    q.close[i] != null && q.open[i] != null && q.high[i] != null && q.low[i] != null && q.volume[i] != null
  );

  const closes = validIdx.map(i => q.close[i]);
  const opens = validIdx.map(i => q.open[i]);
  const highs = validIdx.map(i => q.high[i]);
  const lows = validIdx.map(i => q.low[i]);
  const volumes = validIdx.map(i => q.volume[i]);
  const ts = validIdx.map(i => timestamps[i]);

  if (closes.length < 2) throw new Error("Data tidak cukup untuk kalkulasi indikator");

  const currentPrice = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const change1d = currentPrice - prevClose;
  const change1dPct = (change1d / prevClose) * 100;

  const rsi = calcRSI(closes);
  const macdResult = calcMACD(closes);
  const ma20 = calcSMA(closes, 20);
  const ma50 = calcSMA(closes, 50);
  const ma200 = calcSMA(closes, 200);
  const ma20Above50 = ma20 > ma50;
  const avgVol20 = calcSMA(volumes, 20);
  const todayVol = volumes[volumes.length - 1];
  const volumeBreakout = todayVol > avgVol20 * 1.5;
  const boll = calcBollinger(closes);

  const prevH = highs[highs.length - 2] || currentPrice;
  const prevL = lows[lows.length - 2] || currentPrice;
  const prevC = closes[closes.length - 2] || currentPrice;
  const pivotP = (prevH + prevL + prevC) / 3;
  const s1 = (2 * pivotP) - prevH;
  const r1 = (2 * pivotP) - prevL;
  const swingH = Math.max(...highs.slice(-20));
  const swingL = Math.min(...lows.slice(-20));
  const high52w = Math.max(...highs);
  const low52w = Math.min(...lows);

  const ema20arr = calcEMA(closes, 20);
  const ema50arr = calcEMA(closes, 50);

  const chartLen = Math.min(60, closes.length);
  const chartData = Array.from({ length: chartLen }, (_, i) => {
    const idx = closes.length - chartLen + i;
    return {
      ts: ts[idx], open: opens[idx], high: highs[idx], low: lows[idx], close: closes[idx],
      vol: volumes[idx], ma20: ema20arr[idx], ma50: ema50arr[idx],
    };
  });

  // FIX: renamed macdHistArr (array for chart) vs macdHistValue (scalar for display)
  const macdHistArr = macdResult.histArr?.slice(-60) || [];
  const macdHistValue = macdResult.hist;

  let fund = {
    name: ticker, sector: "Industrials",
    pe: 0, pbv: 0, der: 0, roe: 0, roa: 0, eps: 0, epsGrowth: 0,
    revenue: 0, netIncome: 0, divYield: 0, marketCap: 0,
    analystRec: "", analystCount: 0, targetPrice: 0,
  };

  try {
    const body = {
      symbols: { tickers: [`IDX:${ticker}`] },
      columns: [
        'price_earnings_ttm', 'price_book_ratio',
        'return_on_equity', 'return_on_assets', 'debt_to_equity',
        'earnings_per_share_basic_ttm', 'market_cap_basic', 'dividend_yield_recent',
        'Recommend.All', 'Recommend.All|15', 'Recommend.All|60', 'Recommend.All|1W'
      ]
    };
    const tvRaw = await fetch('https://scanner.tradingview.com/indonesia/scan', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body)
    });
    if (tvRaw.ok) {
      const tvJson = await tvRaw.json();
      const d = tvJson?.data?.[0]?.d;
      if (d) {
        fund.pe = nf(d[0]); fund.pbv = nf(d[1]); fund.roe = nf(d[2]);
        fund.roa = nf(d[3]); fund.der = nf(d[4]) / 100; fund.eps = nf(d[5]);
        fund.marketCap = nf(d[6]); fund.divYield = nf(d[7]);
        const getSig = (val) => val > 0.5 ? "STRONG BUY" : val > 0.1 ? "BUY" : val >= -0.1 ? "NEUTRAL" : val >= -0.5 ? "SELL" : "STRONG SELL";
        fund.analystRec = getSig(nf(d[8]));
        fund.tvAdvice = {
          scalping: getSig(nf(d[9])), intraday: getSig(nf(d[10])),
          swing: getSig(nf(d[8])), invest: getSig(nf(d[11]))
        };
        fund.analystCount = 1;
        fund.name = result.meta?.longName || result.meta?.shortName || ticker;
      }
    }
  } catch (_) { }

  return {
    ...fund,
    currentPrice, prevClose, change1dPct,
    currentOpen: opens[opens.length - 1],
    // FIX: was dayHigh/dayLow but UI referenced currentHigh/currentLow — unified here
    dayHigh: highs[highs.length - 1],
    dayLow: lows[lows.length - 1],
    todayVol, high52w, low52w,
    pivotP, s1, r1, swingH, swingL,
    rsi,
    macdSignal: macdResult.signal,
    macdValue: macdResult.macd,
    macdSig: macdResult.sig,
    macdHistValue,   // FIX: scalar for display
    macdHistArr,     // FIX: array for chart
    ma20, ma50, ma200, ma20Above50,
    avgVol20, volumeBreakout,
    boll_upper: boll.upper, boll_mid: boll.mid, boll_lower: boll.lower,
    chartData,
  };
}

// ─── EXPLORE DATA ─────────────────────────────────────────────────────────────
async function fetchExploreData() {
  const base = { options: { lang: "en" }, markets: ["indonesia"], symbols: { query: { types: ["stock"] }, tickers: [] }, columns: ["name", "Recommend.All", "close", "change", "sector", "volume"] };
  const getReq = (filter, sort) => ({ ...base, filter, sort, range: [0, 6] });
  const reqs = [
    getReq([{ left: "Recommend.All", operation: "greater", right: 0.1 }, { left: "volume", operation: "greater", right: 20000000 }], { sortBy: "Recommend.All", sortOrder: "desc" }),
    getReq([{ left: "change", operation: "greater", right: 2 }, { left: "volume", operation: "greater", right: 10000000 }], { sortBy: "change", sortOrder: "desc" }),
    getReq([{ left: "volume", operation: "greater", right: 50000000 }], { sortBy: "volume", sortOrder: "desc" }),
    getReq([
      { left: "Recommend.All", operation: "greater", right: 0.1 },
      { left: "market_cap_basic", operation: "in_range", right: [500000000000, 10000000000000] },
      { left: "price_earnings_ttm", operation: "less", right: 15 },
      { left: "price_earnings_ttm", operation: "greater", right: 0 },
      { left: "price_book_ratio", operation: "less", right: 1.5 },
      { left: "return_on_equity", operation: "greater", right: 10 },
      { left: "debt_to_equity", operation: "in_range", right: [0, 150] }
    ], { sortBy: "Recommend.All", sortOrder: "desc" })
  ];
  try {
    const res = await Promise.all(reqs.map(body =>
      fetch("https://scanner.tradingview.com/indonesia/scan", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) })
        .then(r => r.json())
    ));
    const mapD = (x) => ({ ticker: x.s.replace("IDX:", ""), name: x.d[0], rec: x.d[1], price: x.d[2], chg: x.d[3] });
    return {
      strongBuy: res[0]?.data?.map(mapD) || [],
      topGainers: res[1]?.data?.map(mapD) || [],
      active: res[2]?.data?.map(mapD) || [],
      multibagger: res[3]?.data?.map(mapD) || []
    };
  } catch (e) { return null; }
}

// ─── SHARED GEMINI CALLER (model fallback + verbose errors) ─────────────────
// Model priority: newest stable → lite fallback → 2.0 fallback
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

async function callGemini(apiKey, contents, label = "AI") {
  let lastStatus = null;
  let lastBody = null;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        lastStatus = res.status;
        const errMsg = json?.error?.message || JSON.stringify(json);
        lastBody = errMsg;
        // 401 = bad key → no point retrying other models
        if (res.status === 401) {
          throw new Error(`🔑 API Key ditolak (401): ${errMsg}`);
        }
        // 404 = model not found → try next model
        if (res.status === 404) continue;
        // 429 = rate limit → try next model
        if (res.status === 429) continue;
        // Other errors → stop
        throw new Error(`[${model}] HTTP ${res.status}: ${errMsg}`);
      }

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`[${model}] Respons kosong dari API`);
      return { text, model };

    } catch (err) {
      // Re-throw hard errors (401, non-HTTP)
      if (err.message.includes("401") || err.message.includes("API Key")) throw err;
      lastBody = err.message;
      // Continue to next model for soft failures
      continue;
    }
  }

  // All models failed
  throw new Error(
    `Semua model gagal (${label}). ` +
    `Status terakhir: ${lastStatus ?? "network error"}. ` +
    `Detail: ${lastBody ?? "tidak ada respons"}`
  );
}

// ─── AI: FUND MANAGER ────────────────────────────────────────────────────────
async function fetchAiFundManager(ticker, data, scores, apiKey, setResult, setLoading) {
  if (!apiKey) { setResult({ noKey: true }); return; }
  setLoading(true); setResult(null);
  const volRatio = data.avgVol20 > 0 ? (data.todayVol / data.avgVol20).toFixed(1) : "1";
  const pct52w = data.high52w > 0 ? Math.round((data.currentPrice / data.high52w) * 100) : 0;
  const tvSwing = data.tvAdvice?.swing || "TIDAK ADA";
  const tvInvest = data.tvAdvice?.invest || "TIDAK ADA";
  const tvScalp = data.tvAdvice?.scalping || "TIDAK ADA";
  const tvIntraday = data.tvAdvice?.intraday || "TIDAK ADA";
  const macdLabel = { bullish_cross: "BULLISH CROSS (sinyal beli kuat)", above_signal: "DI ATAS SIGNAL (uptrend)", neutral: "NETRAL", bearish: "BEARISH CROSS (sinyal jual)" }[data.macdSignal] || data.macdSignal;
  const goldenDeath = data.ma20Above50 ? "Golden Cross aktif (MA20 di atas MA50)" : "Death Cross aktif (MA20 di bawah MA50)";
  const vsMA50 = data.currentPrice > data.ma50 ? `di ATAS MA50 (+${((data.currentPrice / data.ma50 - 1) * 100).toFixed(1)}%)` : `di BAWAH MA50 (-${((1 - data.currentPrice / data.ma50) * 100).toFixed(1)}%)`;

  const prompt = `Anda adalah AI Fund Manager senior pasar modal Indonesia yang berpengalaman menganalisis saham BEI. Tugas Anda adalah menganalisis SEMUA data berikut secara MENYELURUH dan KONSISTEN — jangan hanya fokus pada satu aspek.

=== DATA LENGKAP SAHAM ${ticker} ===

[SKOR SISTEM SCANNER]
- Composite Score: ${scores.comp}/100
- Skor Fundamental: ${scores.fund}/100
- Skor Teknikal: ${scores.tech}/100
- Skor Tekanan Harga (Bandarmologi): ${scores.band}/100

[FUNDAMENTAL]
- P/E Ratio: ${data.pe}x
- P/BV: ${data.pbv}x
- DER (Debt/Equity): ${data.der}x
- ROE: ${data.roe}%
- ROA: ${data.roa}%
- Dividen Yield: ${data.divYield}%

[TEKNIKAL — dihitung dari candlestick asli]
- RSI (14): ${data.rsi} ${data.rsi < 30 ? "(OVERSOLD — potensi reversal)" : data.rsi > 70 ? "(OVERBOUGHT — rawan koreksi)" : "(NORMAL)"}
- MACD: ${macdLabel}
- Moving Average: ${goldenDeath}
- Harga vs MA50: ${vsMA50}
- Volume hari ini: ${volRatio}x rata-rata 20 hari ${data.volumeBreakout ? "(BREAKOUT VOLUME)" : ""}
- Posisi harga vs 52w-High: ${pct52w}% (${pct52w < 60 ? "jauh dari puncak, potensi upside besar" : pct52w < 80 ? "dalam rentang menengah" : "mendekati puncak"})
- Bollinger Band: Harga ${data.currentPrice <= data.boll_lower * 1.02 ? "MENYENTUH lower band (potensi rebound)" : data.currentPrice >= data.boll_upper * 0.98 ? "menyentuh upper band (rawan koreksi)" : "di tengah band (normal)"}

[KONSENSUS TRADINGVIEW AI — sumber independen]
- Scalping (15 menit): ${tvScalp}
- Intraday (1 jam): ${tvIntraday}
- Swing Trading (Harian): ${tvSwing}
- Investasi (Mingguan): ${tvInvest}
- Konsensus Keseluruhan: ${data.analystRec || "TIDAK ADA"}

=== INSTRUKSI ANALISIS ===
Berikan analisis TERINTEGRASI yang merekonsiliasi semua data di atas. Jika ada konflik antara fundamental lemah vs teknikal kuat (atau sebaliknya), JELASKAN KONFLIK ITU secara eksplisit — jangan diabaikan.

Untuk saham spekulatif/momentum (fundamental lemah tapi teknikal kuat), akui bahwa ini adalah "trading opportunity" bukan "investment grade", dan jelaskan perbedaannya.

Respons HARUS dalam format JSON murni (tanpa markdown, tanpa backtick, tanpa teks di luar JSON):
{"fundamental":"2-3 kalimat jujur tentang kesehatan keuangan perusahaan","technical":"2-3 kalimat tentang kondisi teknikal TERMASUK konfirmasi/kontradiksi dengan konsensus TradingView","momentum":"1-2 kalimat tentang momentum harga, volume, dan posisi vs 52w-high","conflict":"Jika fundamental dan teknikal BERTENTANGAN jelaskan konflik dalam 1-2 kalimat. Jika sejalan isi string kosong.","verdict":"1 kalimat tegas merekonsiliasi semua data misal TRADING BUY atau BELI SPEKULATIF atau TAHAN","risk":"1 kalimat risiko terbesar spesifik berdasarkan data di atas"}`;

  try {
    const { text, model } = await callGemini(apiKey, [{ parts: [{ text: prompt }] }], "Fund Manager");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    setResult({ ...parsed, _model: model });
  } catch (err) {
    setResult({ error: err.message });
  } finally { setLoading(false); }
}

// ─── AI: NEWS SENTIMENT ───────────────────────────────────────────────────────
async function fetchAiNewsSentiment(headlines, ticker, apiKey, setResult, setLoading) {
  if (!apiKey || !headlines.length) { setResult({ noData: true }); return; }
  setLoading(true); setResult(null);
  const headlineText = headlines.map((h, i) => `${i + 1}. "${h.title}" — ${h.publisher}`).join("\n");
  const prompt = `Analis sentimen berita pasar modal Indonesia untuk saham ${ticker}. Berikan JSON murni (TANPA markdown, TANPA backtick):
{"overall":"POSITIF atau NEGATIF atau NETRAL","score":angka -100 sampai 100,"summary":"1-2 kalimat ringkasan tone berita keseluruhan","catalysts":["catalyst positif 1","catalyst positif 2"],"risks":["risiko dari berita 1","risiko dari berita 2"]}
Headlines:\n${headlineText}`;
  try {
    const { text, model } = await callGemini(apiKey, [{ parts: [{ text: prompt }] }], "Sentimen");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    setResult({ ...parsed, _model: model });
  } catch (err) {
    setResult({ error: err.message });
  } finally { setLoading(false); }
}

// ─── AI: SMART CHATBOX ────────────────────────────────────────────────────────
async function sendChatMessage(messages, ticker, data, apiKey, onChunk, onDone) {
  if (!apiKey) { onDone("Masukkan API Key Gemini di ⚙️ pojok kanan atas terlebih dahulu."); return; }
  const systemCtx = `Anda adalah asisten analis saham BEI yang ahli. Data real-time saham ${ticker}: Harga ${data.currentPrice}, RSI ${data.rsi}, MACD ${data.macdSignal}, P/E ${data.pe}x, ROE ${data.roe}%, MA20 ${Math.round(data.ma20)}, MA50 ${Math.round(data.ma50)}, Support S1 ${Math.round(data.s1)}, Resistance R1 ${Math.round(data.r1)}, Volume ${data.volumeBreakout ? "breakout" : "normal"}. Jawab singkat, lugas, dalam bahasa Indonesia.`;
  const geminiMessages = [
    { role: "user", parts: [{ text: systemCtx }] },
    { role: "model", parts: [{ text: "Siap! Saya akan membantu analisis saham " + ticker + " berdasarkan data real-time tersebut." }] },
    ...messages.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }))
  ];
  try {
    const { text } = await callGemini(apiKey, geminiMessages, "Chat");
    onDone(text);
  } catch (err) {
    onDone(`⚠ Error: ${err.message}`);
  }
}

// ─── CHART COMPONENT ──────────────────────────────────────────────────────────
function PriceChart({ data, ticker, macdHistArr }) {
  if (!data || data.length < 5) return null;
  const W = 520, H = 180, PB = 30, PT = 10, PL = 8, PR = 50;
  const cW = W - PL - PR, cH = H - PT - PB;
  const volH = 35;

  const closes = data.map(d => d.close);
  const ma20s = data.map(d => d.ma20);
  const ma50s = data.map(d => d.ma50);
  const vols = data.map(d => d.vol);

  const maxP = Math.max(...closes, ...ma20s.filter(Boolean), ...ma50s.filter(Boolean));
  const minP = Math.min(...closes, ...ma20s.filter(Boolean), ...ma50s.filter(Boolean));
  const rangeP = maxP - minP || 1;
  const maxV = Math.max(...vols) || 1;

  const px = (i) => PL + i * (cW / (data.length - 1));
  const py = (v) => PT + cH - (((v - minP) / rangeP) * cH);
  const pvy = (v) => H - PB - (v / maxV) * volH;

  const closePath = "M" + closes.map((v, i) => `${px(i)},${py(v)}`).join("L");
  const ma20Path = ma20s.every(Boolean) ? "M" + ma20s.map((v, i) => `${px(i)},${py(v)}`).join("L") : "";
  const ma50Path = ma50s.every(Boolean) ? "M" + ma50s.map((v, i) => `${px(i)},${py(v)}`).join("L") : "";
  const last = closes.length - 1;
  const lastClose = closes[last];
  const change = lastClose - (closes[last - 1] || lastClose);
  const lineColor = change >= 0 ? "#4ade80" : "#f87171";
  const priceLabels = [minP, minP + rangeP * 0.25, minP + rangeP * 0.5, minP + rangeP * 0.75, maxP];
  const MH = 45, MHtop = H + 8;
  const maxHist = Math.max(...macdHistArr.map(Math.abs), 0.001);
  const histW = macdHistArr.length > 0 ? cW / macdHistArr.length : 4;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + MH + 18}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
        <clipPath id="chartClip"><rect x={PL} y={PT} width={cW} height={cH} /></clipPath>
      </defs>
      {priceLabels.map((p, i) => (
        <g key={i}>
          <line x1={PL} y1={py(p)} x2={W - PR + 4} y2={py(p)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={W - PR + 8} y={py(p) + 4} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">{Math.round(p).toLocaleString("id-ID")}</text>
        </g>
      ))}
      <path d={`${closePath}L${px(last)},${H - PB}L${px(0)},${H - PB}Z`} fill="url(#areaGrad)" clipPath="url(#chartClip)" />
      {vols.map((v, i) => (
        <rect key={i} x={px(i) - histW * 0.4} y={pvy(v)} width={Math.max(histW * 0.8, 1)} height={H - PB - pvy(v)}
          fill={closes[i] >= (closes[i - 1] || closes[i]) ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"} />
      ))}
      {ma50Path && <path d={ma50Path} fill="none" stroke="#60a5fa" strokeWidth="1.2" strokeDasharray="3,2" clipPath="url(#chartClip)" />}
      {ma20Path && <path d={ma20Path} fill="none" stroke="#f5c842" strokeWidth="1.2" clipPath="url(#chartClip)" />}
      <path d={closePath} fill="none" stroke={lineColor} strokeWidth="1.8" clipPath="url(#chartClip)" style={{ filter: `drop-shadow(0 0 3px ${lineColor}80)` }} />
      <circle cx={px(last)} cy={py(lastClose)} r="3.5" fill={lineColor} style={{ filter: `drop-shadow(0 0 5px ${lineColor})` }} />
      <g transform={`translate(${PL + 4},${PT + 4})`}>
        <rect width="6" height="6" fill="#f5c842" rx="1" />
        <text x="9" y="6" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">MA20</text>
        <rect x="40" width="6" height="6" fill="#60a5fa" rx="1" />
        <text x="49" y="6" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">MA50</text>
      </g>
      <text x={PL} y={MHtop + 8} fill="rgba(255,255,255,0.25)" fontSize="7" fontFamily="monospace" letterSpacing="1">MACD HISTOGRAM</text>
      <line x1={PL} y1={MHtop + MH / 2 + 12} x2={W - PR} y2={MHtop + MH / 2 + 12} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {macdHistArr.map((h, i) => {
        const bw = Math.max((cW / macdHistArr.length) * 0.7, 1);
        const bx = PL + i * (cW / macdHistArr.length);
        const bh = Math.abs(h / maxHist) * (MH / 2 - 4);
        const by = h >= 0 ? MHtop + MH / 2 + 12 - bh : MHtop + MH / 2 + 12;
        return <rect key={i} x={bx} y={by} width={bw} height={Math.max(bh, 1)} fill={h >= 0 ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)"} />;
      })}
    </svg>
  );
}

// ─── ARC METER ────────────────────────────────────────────────────────────────
function ArcMeter({ value, color, label }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 200); return () => clearTimeout(t); }, [value]);
  const r = 36, circ = 2 * Math.PI * r, dash = (anim / 100) * circ * 0.75;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeDashoffset={circ * 0.125}
          transform="rotate(135 45 45)" strokeLinecap="round" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.125}
          transform="rotate(135 45 45)" strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 5px ${color})` }} />
        <text x="45" y="43" textAnchor="middle" fill={color} style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 700 }}>{Math.round(anim)}</text>
        <text x="45" y="56" textAnchor="middle" fill="rgba(255,255,255,0.22)" style={{ fontFamily: "monospace", fontSize: 7 }}>/100</text>
      </svg>
      <span style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function StatBox({ label, value, sub, color = "#fff", hi = false }) {
  return (
    <div style={{ background: hi ? `${color}12` : "rgba(255,255,255,0.03)", border: `1px solid ${hi ? color + "30" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 1.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'IBM Plex Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── AI FUND MANAGER PANEL ────────────────────────────────────────────────────
function AiFundManagerPanel({ result, loading, onRefresh }) {
  const sections = [
    { key: "fundamental", label: "📊 Fundamental", color: "#f5c842" },
    { key: "technical", label: "📈 Teknikal + TradingView", color: "#38bdf8" },
    { key: "momentum", label: "⚡ Momentum", color: "#a78bfa" },
  ];
  const hasConflict = result?.conflict && result.conflict.trim().length > 0;

  return (
    <div style={{ background: "linear-gradient(145deg,rgba(16,185,129,0.06),rgba(59,130,246,0.04))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: 2 }}>AI FUND MANAGER</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>Analisis terintegrasi · {result?._model ? `✓ ${result._model}` : "Gemini"}</div>
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading}
          style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace" }}>
          {loading ? "⌛ Menganalisis..." : "↻ REFRESH"}
        </button>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sections.map((s) => (
            <div key={s.key} style={{ height: 40, background: "rgba(255,255,255,0.03)", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}

      {!loading && result?.noKey && (
        <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
          🔑 Masukkan API Key Gemini di ⚙️ pojok kanan atas untuk mengaktifkan AI Fund Manager
        </div>
      )}

      {!loading && result?.error && (
        <div style={{ padding: "10px 14px", background: "rgba(248,113,113,0.1)", borderRadius: 8, fontSize: 10, color: "#f87171" }}>
          ⚠ {result.error}
        </div>
      )}

      {!loading && result && !result.error && !result.noKey && (
        <div style={{ display: "grid", gap: 8 }}>
          {/* 3-column top row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {sections.map(s => (
              <div key={s.key} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 8, color: s.color, letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontFamily: "'Courier New',monospace" }}>{result[s.key] || "—"}</div>
              </div>
            ))}
          </div>

          {/* ⚡ CONFLICT ALERT — hanya muncul jika fundamental vs teknikal bertentangan */}
          {hasConflict && (
            <div style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,146,60,0.06))", border: "1.5px solid rgba(251,191,36,0.4)", borderRadius: 10, padding: "11px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚡</span>
              <div>
                <div style={{ fontSize: 8, color: "#fbbf24", letterSpacing: 2, marginBottom: 5, fontWeight: 700 }}>SINYAL KONFLIK TERDETEKSI — FUNDAMENTAL vs TEKNIKAL</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", lineHeight: 1.65 }}>{result.conflict}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                  💡 Konflik ini normal dan PENTING diketahui. Baca vonis di bawah untuk rekonsiliasi.
                </div>
              </div>
            </div>
          )}

          {/* Verdict */}
          <div style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚖️</span>
            <div>
              <div style={{ fontSize: 8, color: "#4ade80", letterSpacing: 1, marginBottom: 4 }}>VONIS — REKONSILIASI SEMUA DATA + KONSENSUS TRADINGVIEW</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.55 }}>{result.verdict || "—"}</div>
            </div>
          </div>

          {/* Risk */}
          <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 8, color: "#f87171", letterSpacing: 1, marginBottom: 4 }}>RISIKO UTAMA</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{result.risk || "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NEWS SENTIMENT PANEL ─────────────────────────────────────────────────────
function NewsSentimentPanel({ headlines, sentiment, sentimentLoading, hasKey, newsLoading }) {
  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
  };

  const sentColor = sentiment?.overall === "POSITIF" ? "#4ade80" : sentiment?.overall === "NEGATIF" ? "#f87171" : "#fbbf24";
  const scoreBar = sentiment?.score !== undefined ? Math.min(100, Math.max(0, (sentiment.score + 100) / 2)) : 50;

  // Tally sources for the summary strip
  const sourceTally = {};
  headlines.forEach(h => {
    const pub = h.publisher || "Lainnya";
    sourceTally[pub] = (sourceTally[pub] || 0) + 1;
  });
  const uniqueSources = Object.keys(sourceTally);
  const idSources = uniqueSources.filter(s => getSourceMeta(s).flag === "🇮🇩");
  const globalSources = uniqueSources.filter(s => getSourceMeta(s).flag === "🌐");

  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3 }}>📰 ANALISIS SENTIMEN BERITA — PILAR KETIGA</div>
        {headlines.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {idSources.length > 0 && (
              <div style={{ fontSize: 7, padding: "2px 8px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                🇮🇩 {idSources.length} sumber lokal
              </div>
            )}
            {globalSources.length > 0 && (
              <div style={{ fontSize: 7, padding: "2px 8px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }}>
                🌐 {globalSources.length} sumber global
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source legend */}
      {headlines.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {uniqueSources.slice(0, 8).map(src => {
            const meta = getSourceMeta(src);
            return (
              <div key={src} style={{ fontSize: 7, padding: "2px 7px", borderRadius: 8, background: `${meta.color}15`, border: `1px solid ${meta.color}35`, color: meta.color }}>
                {meta.flag} {src.split(".")[0]}
              </div>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {newsLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 52, background: "rgba(255,255,255,0.03)", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
          ))}
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 4 }}>
            ⏳ Mengumpulkan berita dari Yahoo Finance, Google News ID, Kontan, Bisnis.com...
          </div>
        </div>
      )}

      {!newsLoading && headlines.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
          Tidak ada berita terbaru ditemukan dari semua sumber untuk saham ini.
        </div>
      )}

      {!newsLoading && headlines.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: (sentiment || sentimentLoading) ? "1fr 1fr" : "1fr", gap: 14 }}>
          {/* Headlines list */}
          <div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>
              HEADLINE TERBARU — {headlines.length} artikel dari {uniqueSources.length} sumber
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
              {headlines.map((h, i) => {
                const meta = getSourceMeta(h.publisher);
                return (
                  <div key={i} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 5, borderLeft: `2px solid ${meta.color}60` }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", lineHeight: 1.45, marginBottom: 5 }}>
                      {h.link && h.link !== "#"
                        ? <a href={h.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{h.title}</a>
                        : h.title}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 7, padding: "1px 6px", borderRadius: 6, background: `${meta.color}18`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                        {meta.flag} {h.publisher?.split(".")[0] || "—"}
                      </span>
                      {h.time > 0 && (
                        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.22)" }}>{timeAgo(h.time)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!hasKey && (
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 8, fontStyle: "italic", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                🔑 Tambahkan API Key Gemini untuk analisis sentimen AI dari berita-berita di atas
              </div>
            )}
          </div>

          {/* Sentiment analysis column */}
          <div>
            {sentimentLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "#60a5fa", fontSize: 10 }}>
                <div style={{ width: 24, height: 24, border: "2px solid rgba(96,165,250,0.2)", borderTop: "2px solid #60a5fa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ animation: "pulse 1.5s infinite" }}>🧠 Menganalisis sentimen {headlines.length} artikel...</span>
              </div>
            )}

            {!sentimentLoading && sentiment && !sentiment.error && !sentiment.noData && (
              <div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>SKOR SENTIMEN AI</div>
                <div style={{ background: `${sentColor}10`, border: `1px solid ${sentColor}30`, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: sentColor, fontFamily: "monospace" }}>{sentiment.overall}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: sentColor }}>{sentiment.score > 0 ? "+" : ""}{sentiment.score}</span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${scoreBar}%`, background: `linear-gradient(90deg,#f87171,#fbbf24 50%,#4ade80)`, borderRadius: 3, transition: "width 1s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>
                    <span>Sangat Negatif</span><span>Netral</span><span>Sangat Positif</span>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>{sentiment.summary}</div>
                </div>

                {sentiment.catalysts?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 8, color: "#4ade80", letterSpacing: 1, marginBottom: 5 }}>✓ KATALIS POSITIF DARI BERITA</div>
                    {sentiment.catalysts.map((c, i) => (
                      <div key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", padding: "5px 9px", background: "rgba(74,222,128,0.06)", borderRadius: 6, marginBottom: 4, lineHeight: 1.5 }}>• {c}</div>
                    ))}
                  </div>
                )}
                {sentiment.risks?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 8, color: "#f87171", letterSpacing: 1, marginBottom: 5 }}>⚠ RISIKO DARI PEMBERITAAN</div>
                    {sentiment.risks.map((r, i) => (
                      <div key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", padding: "5px 9px", background: "rgba(248,113,113,0.06)", borderRadius: 6, marginBottom: 4, lineHeight: 1.5 }}>• {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!sentimentLoading && sentiment?.error && (
              <div style={{ padding: "10px", background: "rgba(248,113,113,0.08)", borderRadius: 8, fontSize: 9, color: "#f87171" }}>
                ⚠ {sentiment.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SMART CHATBOX ────────────────────────────────────────────────────────────
function SmartChatbox({ ticker, data, apiKey, open, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [prevTicker, setPrevTicker] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (ticker !== prevTicker) {
      setMessages([{
        role: "assistant",
        content: `Halo! 👋 Saya siap menjawab pertanyaan Anda tentang **${ticker}**. Tanyakan apa saja — strategi masuk, analisis risiko, perbandingan sektor, dll.`
      }]);
      setPrevTicker(ticker);
    }
  }, [ticker]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  const sendMsg = async () => {
    const txt = input.trim();
    if (!txt || isThinking) return;
    const newMsgs = [...messages, { role: "user", content: txt }];
    setMessages(newMsgs);
    setInput("");
    setIsThinking(true);
    await sendChatMessage(
      newMsgs.filter(m => m.role === "user" || m.role === "assistant").slice(-10),
      ticker, data, apiKey,
      null,
      (reply) => {
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
        setIsThinking(false);
      }
    );
  };

  const suggestions = [
    `Kapan waktu terbaik beli ${ticker}?`,
    `Apa risiko terbesar ${ticker} saat ini?`,
    `Bandingkan ${ticker} dengan sektornya`,
    `Berapa target harga realistis?`,
  ];

  if (!open) return null;

  return (
    <div style={{ position: "fixed", bottom: 80, right: 16, width: 340, height: 480, background: "#0f1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, display: "flex", flexDirection: "column", zIndex: 1000, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", animation: "fadeUp 0.3s ease" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(245,200,66,0.05)", borderRadius: "16px 16px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#f5c842" }}>SMART CHATBOX</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>Tanya AI soal {ticker}</div>
          </div>
        </div>
        <button onClick={onToggle} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "8px 11px", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              background: m.role === "user" ? "rgba(245,200,66,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${m.role === "user" ? "rgba(245,200,66,0.25)" : "rgba(255,255,255,0.07)"}`,
              fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, fontFamily: "'Courier New',monospace", whiteSpace: "pre-wrap"
            }}>{m.content}</div>
          </div>
        ))}
        {isThinking && (
          <div style={{ display: "flex", gap: 4, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: "12px 12px 12px 3px", width: 60 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842", animation: `pulse 1s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div style={{ padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 4 }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { setInput(s); }} style={{ fontSize: 8, padding: "4px 8px", borderRadius: 8, background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.15)", color: "rgba(245,200,66,0.7)", cursor: "pointer", textAlign: "left" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg()}
          placeholder="Tanya tentang saham ini..."
          style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, fontFamily: "'Courier New',monospace", outline: "none" }}
        />
        <button onClick={sendMsg} disabled={!input.trim() || isThinking}
          style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: input.trim() ? "#f5c842" : "rgba(255,255,255,0.05)", color: input.trim() ? "#000" : "rgba(255,255,255,0.2)", cursor: input.trim() ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700 }}>
          ▶
        </button>
      </div>
    </div>
  );
}

// ─── FLEXIBLE TRADING PLAN ────────────────────────────────────────────────────
function FlexibleTradingPlan({ data, avgEntry, tgt, cl, rr, rrOk }) {
  const [capital, setCapital] = useState(10000000);
  const [riskPct, setRiskPct] = useState(2);
  const [horizon, setHorizon] = useState("swing");
  const [showAdv, setShowAdv] = useState(false);

  const riskAmount = capital * riskPct / 100;
  const riskPerShare = avgEntry > cl ? avgEntry - cl : avgEntry * 0.05;
  const sharesRaw = riskAmount / riskPerShare;
  const lots = Math.max(1, Math.floor(sharesRaw / 100));
  const shares = lots * 100;
  const totalPosition = shares * avgEntry;
  const positionPct = capital > 0 ? ((totalPosition / capital) * 100).toFixed(1) : 0;
  const maxLoss = shares * (avgEntry - cl);
  const maxGain = shares * (tgt - avgEntry);
  const horizonMap = { scalping: { label: "Scalping (1 Hari)", color: "#f87171" }, swing: { label: "Swing (1-4 Minggu)", color: "#fbbf24" }, invest: { label: "Investasi (3+ Bulan)", color: "#4ade80" } };
  const buyAreaStr = `Rp ${fmt(Math.round(cl > 0 ? Math.max(cl * 1.01, avgEntry * 0.97) : avgEntry * 0.97))} – Rp ${fmt(Math.round(avgEntry))}`;

  const HORIZON_TIPS = {
    scalping: "Scalping membutuhkan disiplin ketat. Gunakan cutloss langsung tanpa kompromi. Target harian 0.5–1.5%.",
    swing: "Swing trading ideal untuk konfirmasi breakout atau bounce support. Hold 5–20 hari. Review setiap akhir sesi.",
    invest: "Investasi jangka panjang: fokus pada fundamental. Volume dan RSI harian kurang relevan. Averaging down jika fundamental tetap kuat.",
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3 }}>🛡️ PENASIHAT TRADING PLAN FLEKSIBEL</div>
        <button onClick={() => setShowAdv(!showAdv)} style={{ fontSize: 8, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
          {showAdv ? "▲ Sembunyikan" : "▼ Ubah Parameter"}
        </button>
      </div>

      {/* Parameter inputs */}
      {showAdv && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>💰 MODAL (IDR)</div>
            <input type="number" value={capital} onChange={e => setCapital(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "7px 10px", color: "#f5c842", fontFamily: "monospace", fontSize: 11, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>= {capital >= 1e9 ? `${(capital / 1e9).toFixed(1)}M` : capital >= 1e6 ? `${(capital / 1e6).toFixed(1)} Jt` : fmt(capital)}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>⚠ RISIKO PER TRADE (%)</div>
            <input type="number" min="0.5" max="10" step="0.5" value={riskPct} onChange={e => setRiskPct(Math.min(10, Math.max(0.5, parseFloat(e.target.value) || 2)))}
              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "7px 10px", color: "#f87171", fontFamily: "monospace", fontSize: 11, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>Max rugi: Rp {fmt(riskAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>⏱ HORIZON TRADING</div>
            <select value={horizon} onChange={e => setHorizon(e.target.value)}
              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "7px 10px", color: horizonMap[horizon].color, fontFamily: "monospace", fontSize: 10, outline: "none", boxSizing: "border-box" }}>
              {Object.entries(horizonMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Main plan grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { l: "BUY AREA", v: buyAreaStr, c: "#94a3b8", h: "Rentang antri beli ideal" },
          { l: "TARGET HARGA", v: `Rp ${fmt(Math.round(tgt))}`, c: "#4ade80", h: avgEntry > 0 ? `+${Math.round((tgt / avgEntry - 1) * 100)}% dari avg entry` : "" },
          { l: "CUT LOSS", v: `Rp ${fmt(Math.round(cl))}`, c: "#f87171", h: avgEntry > 0 ? `-${Math.round((1 - cl / avgEntry) * 100)}% dari avg entry` : "" },
        ].map(({ l, v, c, h }) => (
          <div key={l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", letterSpacing: 2, marginBottom: 5 }}>{l}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{v}</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", marginTop: 3 }}>{h}</div>
          </div>
        ))}
      </div>

      {/* Position sizing */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { l: "JUMLAH LOT", v: `${lots} Lot`, sub: `${fmt(shares)} lembar`, c: "#f5c842" },
          { l: "TOTAL POSISI", v: totalPosition >= 1e9 ? `${(totalPosition / 1e9).toFixed(2)}M` : `${(totalPosition / 1e6).toFixed(1)} Jt`, sub: `${positionPct}% modal`, c: "#60a5fa" },
          { l: "MAX GAIN", v: maxGain >= 1e6 ? `+${(maxGain / 1e6).toFixed(1)} Jt` : `+${fmt(maxGain)}`, sub: `${maxGain > 0 ? ((maxGain / capital) * 100).toFixed(1) : 0}% modal`, c: "#4ade80" },
          { l: "MAX LOSS", v: `-${maxLoss >= 1e6 ? (maxLoss / 1e6).toFixed(1) + " Jt" : fmt(maxLoss)}`, sub: `${riskPct}% modal`, c: "#f87171" },
        ].map(({ l, v, sub, c }) => (
          <div key={l} style={{ background: `${c}08`, border: `1px solid ${c}20`, borderRadius: 9, padding: "9px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{v}</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* RR Ratio + horizon badge */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", background: rrOk ? "rgba(74,222,128,0.07)" : "rgba(251,146,60,0.07)", border: `1px solid ${rrOk ? "rgba(74,222,128,0.2)" : "rgba(251,146,60,0.2)"}`, borderRadius: 9, padding: "9px 14px" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Risk / Reward Ratio</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: rrOk ? "#4ade80" : "#fb923c", fontFamily: "'IBM Plex Mono',monospace" }}>1 : {rr} {rrOk ? "✓" : "⚠"}</span>
        </div>
        <div style={{ padding: "9px 14px", background: `${horizonMap[horizon].color}12`, border: `1px solid ${horizonMap[horizon].color}30`, borderRadius: 9, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: horizonMap[horizon].color, fontWeight: 700 }}>⏱ {horizonMap[horizon].label}</span>
        </div>
      </div>

      {/* Horizon tip */}
      <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 9, color: "rgba(255,255,255,0.4)", borderLeft: `2px solid ${horizonMap[horizon].color}50`, lineHeight: 1.6 }}>
        💡 {HORIZON_TIPS[horizon]}
      </div>
    </div>
  );
}

// ─── API KEY TESTER ───────────────────────────────────────────────────────────
function ApiKeyTester({ apiKey }) {
  const [status, setStatus] = useState(null); // null | "testing" | {ok, model, error}

  const runTest = async () => {
    if (!apiKey || apiKey.length < 10) {
      setStatus({ ok: false, error: "API Key terlalu pendek / kosong" });
      return;
    }
    setStatus("testing");
    const results = [];
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Jawab hanya: OK" }] }] }),
          }
        );
        const json = await res.json();
        if (res.ok && json?.candidates?.[0]?.content?.parts?.[0]?.text) {
          results.push({ model, status: "✅ OK", http: res.status });
          setStatus({ ok: true, results });
          return; // stop at first success — show and continue testing rest async
        } else {
          const errMsg = json?.error?.message || `HTTP ${res.status}`;
          results.push({ model, status: `❌ ${errMsg}`, http: res.status });
        }
      } catch (e) {
        results.push({ model, status: `⚠ Network: ${e.message}`, http: null });
      }
    }
    setStatus({ ok: false, results, error: "Semua model gagal" });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={runTest} disabled={status === "testing" || !apiKey}
        style={{ width: "100%", padding: "6px", borderRadius: 7, border: "1px solid rgba(245,200,66,0.3)", background: "rgba(245,200,66,0.08)", color: "#f5c842", fontSize: 9, cursor: apiKey ? "pointer" : "not-allowed", fontFamily: "monospace", letterSpacing: 1 }}>
        {status === "testing" ? "⏳ Menguji semua model..." : "🔬 TEST API KEY SEKARANG"}
      </button>

      {status && status !== "testing" && (
        <div style={{ marginTop: 8, fontSize: 8, lineHeight: 1.8 }}>
          {status.results?.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 6px", borderRadius: 4, background: r.status.includes("✅") ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", marginBottom: 2 }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{r.model}</span>
              <span style={{ color: r.status.includes("✅") ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>{r.status}</span>
            </div>
          ))}
          {!status.results && status.error && (
            <div style={{ color: "#f87171", padding: "4px 6px" }}>⚠ {status.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [inputVal, setInputVal] = useState("");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [mktStatus, setMktStatus] = useState(getMarketStatus());
  const timerRef = useRef(null);
  const [exploreData, setExploreData] = useState(null);
  const mktRef = useRef(null);

  // FIX: use window.storage instead of localStorage
  const [geminiKey, setGeminiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // AI Fund Manager
  const [fundManagerResult, setFundManagerResult] = useState(null);
  const [fundManagerLoading, setFundManagerLoading] = useState(false);

  // News + Sentiment
  const [headlines, setHeadlines] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [sentiment, setSentiment] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  // Smart Chatbox
  const [chatOpen, setChatOpen] = useState(false);

  // Load stored key on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("bei_hist");
        if (r?.value) setHistory(JSON.parse(r.value));
      } catch (_) { }
      try {
        const k = await window.storage.get("gemini_key");
        if (k?.value) setGeminiKey(k.value);
      } catch (_) { }
    })();
    mktRef.current = setInterval(() => setMktStatus(getMarketStatus()), 30000);
    fetchExploreData().then(setExploreData);
    return () => clearInterval(mktRef.current);
  }, []);

  const saveGeminiKey = async (val) => {
    setGeminiKey(val);
    try { await window.storage.set("gemini_key", val); } catch (_) { }
  };

  const getCached = async (t) => {
    try {
      const r = await window.storage.get(`bei:${t}`);
      if (!r?.value) return null;
      const p = JSON.parse(r.value);
      if (Date.now() - p.ts < CACHE_TTL) return p.d;
    } catch (_) { }
    return null;
  };

  const setCache = async (t, d) => {
    try { await window.storage.set(`bei:${t}`, JSON.stringify({ ts: Date.now(), d })); } catch (_) { }
  };

  const pushHist = async (t, d, sc) => {
    const g = getGrade(sc.comp);
    const sec = SECTOR_DATA[d.sector] || SECTOR_DATA["Industrials"];
    const e = { ticker: t, name: d.name, comp: sc.comp, color: g.color, sc: sec.color };
    const next = [e, ...history.filter(h => h.ticker !== t)].slice(0, 8);
    setHistory(next);
    try { await window.storage.set("bei_hist", JSON.stringify(next)); } catch (_) { }
  };

  const runAiAnalysis = async (t, d) => {
    const scores = calcScores(d, d.sector);
    // Reset AI states
    setFundManagerResult(null);
    setSentiment(null);
    setHeadlines([]);
    setNewsLoading(false);

    // 1. AI Fund Manager
    fetchAiFundManager(t, d, calcScores(d, d.sector), geminiKey, setFundManagerResult, setFundManagerLoading);

    // 2. Fetch news + sentiment
    setNewsLoading(true);
    const news = await fetchNewsHeadlines(t, d.name);
    setHeadlines(news);
    setNewsLoading(false);
    if (news.length > 0) {
      fetchAiNewsSentiment(news, t, geminiKey, setSentiment, setSentimentLoading);
    }
  };

  const scan = useCallback(async (raw, forceRefresh = false) => {
    const t = raw.trim().toUpperCase().replace(/\.JK$/i, "");
    if (!t || loading) return;
    setLoading(true); setError(""); setData(null); setTicker(t);
    setChatOpen(false);

    if (!forceRefresh) {
      const cached = await getCached(t);
      if (cached) {
        setData(cached); setLoading(false);
        pushHist(t, cached, calcScores(cached, cached.sector));
        runAiAnalysis(t, cached);
        return;
      }
    }

    const msgs = [`🔍 Mencari ${t}.JK...`, "📊 Mengambil OHLCV 2 tahun...", "📈 Kalkulasi RSI, MACD, MA...", "💹 Data fundamental TradingView...", "⚙️ Scoring & AI analysis..."];
    let mi = 0; setLoadMsg(msgs[0]);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => { mi = (mi + 1) % msgs.length; setLoadMsg(msgs[mi]); }, 800);

    try {
      const d = await fetchStockRealtime(t);
      clearInterval(timerRef.current);
      await setCache(t, d);
      setData(d);
      pushHist(t, d, calcScores(d, d.sector));
      runAiAnalysis(t, d);
    } catch (e) {
      clearInterval(timerRef.current);
      setError(e.message);
    } finally { setLoading(false); }
    // FIX: added geminiKey to dependency array
  }, [loading, history, geminiKey]);

  const sc = data ? calcScores(data, data.sector) : { fund: 0, tech: 0, band: 0, comp: 0 };
  const grade = getGrade(sc.comp);
  const ref = SECTOR_DATA[data?.sector] || SECTOR_DATA["Industrials"];
  const sCol = ref.color;
  const entry = nf(data?.currentPrice);
  const chPct = nf(data?.change1dPct);

  // Trading plan calculations
  let baBot = entry * 0.98;
  if (data?.ma20 > 0 && data.ma20 < entry && data.ma20 > entry * 0.90) baBot = data.ma20;
  else if (data?.ma50 > 0 && data.ma50 < entry && data.ma50 > entry * 0.90) baBot = data.ma50;
  else if (data?.boll_lower > 0 && data.boll_lower < entry) baBot = data.boll_lower;
  if (baBot < entry * 0.96) baBot = entry * 0.96;

  const avgEntry = (baBot + entry) / 2;
  const t1 = data?.boll_upper > avgEntry ? data.boll_upper : avgEntry * 1.05;
  const t2 = data?.ma50 > avgEntry ? data.ma50 : avgEntry * 1.08;
  const tgt = Math.max(t1, t2);
  const c1 = (data?.boll_lower > 0 && data?.boll_lower < avgEntry) ? data.boll_lower : avgEntry * 0.95;
  const cl = Math.min(avgEntry * 0.975, c1 * 0.99);
  const rr = cl > 0 && avgEntry > cl ? ((tgt - avgEntry) / (avgEntry - cl)).toFixed(2) : "—";
  const rrOk = parseFloat(rr) >= 2;

  const card = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 14 };

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#07080e", color: "#fff", fontFamily: "'Courier New',monospace", padding: "14px 12px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@800;900&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        *{box-sizing:border-box}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1)}
        select option{background:#0f1117;color:#fff}
      `}</style>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 0 }}>
          <button onClick={() => setShowKeyInput(!showKeyInput)} style={{ background: "transparent", border: "none", color: geminiKey ? "#4ade80" : "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer" }} title="Pengaturan AI Gemini">⚙️</button>
          {showKeyInput && (
            <div style={{ position: "absolute", top: 30, right: 0, background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, width: 290, zIndex: 50, textAlign: "left", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: 700 }}>🔑 API Key Google Gemini</div>
              <input type="password" value={geminiKey} onChange={e => saveGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 12, outline: "none", boxSizing: "border-box" }} />

              {/* Test button */}
              <ApiKeyTester apiKey={geminiKey} />

              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 8, lineHeight: 1.6 }}>
                Mengaktifkan: AI Fund Manager · Sentimen Berita · Smart Chatbox<br />
                Model fallback: 2.5-flash → 2.5-flash-lite → 2.0-flash → 1.5-flash<br />
                Key disimpan lokal di browser (window.storage).
              </div>
              {geminiKey && <div style={{ marginTop: 6, fontSize: 8, color: "#4ade80" }}>✓ API Key tersimpan</div>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 8, letterSpacing: 5, color: "rgba(245,200,66,0.5)", marginBottom: 4 }}>◈ BURSA EFEK INDONESIA</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(18px,4vw,28px)", fontWeight: 900, margin: 0, background: "linear-gradient(130deg,#f5c842 0%,#fff 55%,#94a3b8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Stock Intelligence Scanner
            </h1>
            <p style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", letterSpacing: 2, margin: "4px 0 0" }}>
              DATA REAL · YAHOO FINANCE · RSI/MACD/MA · AI FUND MANAGER · SENTIMEN BERITA
            </p>
          </div>
          <div style={{ padding: "8px 16px", borderRadius: 10, background: `${mktStatus.color}15`, border: `1px solid ${mktStatus.color}40`, textAlign: "center", minWidth: 110 }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>STATUS PASAR</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: mktStatus.color, fontFamily: "'IBM Plex Mono',monospace", animation: mktStatus.open ? "pulse 2s ease infinite" : "none" }}>
              {mktStatus.open ? "● " : ""}{mktStatus.label}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{mktStatus.sub}</div>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 1600, margin: "0 auto", padding: "0 8px" }}>

        {/* SEARCH */}
        <div style={{ background: "rgba(245,200,66,0.05)", border: "1.5px solid rgba(245,200,66,0.18)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "rgba(245,200,66,0.55)", letterSpacing: 3, marginBottom: 10 }}>◈ SCAN SAHAM — DATA REAL-TIME YAHOO FINANCE + TRADINGVIEW</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input value={inputVal} onChange={e => setInputVal(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && scan(inputVal)}
                placeholder="Ketik kode saham BEI... (BBCA, TLKM, ASII)"
                maxLength={8}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 46px 12px 16px", color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 17, fontWeight: 700, outline: "none", letterSpacing: 3, boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#f5c842"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>.JK</span>
            </div>
            <button onClick={() => scan(inputVal)} disabled={loading || !inputVal.trim()}
              style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: (!loading && inputVal) ? "linear-gradient(135deg,#f5c842,#f5a030)" : "rgba(255,255,255,0.06)", color: (!loading && inputVal) ? "#000" : "rgba(255,255,255,0.2)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 700, cursor: (!loading && inputVal) ? "pointer" : "not-allowed", letterSpacing: 1, whiteSpace: "nowrap" }}>
              {loading ? "..." : "SCAN ▶"}
            </button>
            {data && <button onClick={() => scan(ticker, true)} disabled={loading}
              style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", fontFamily: "monospace", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
              ↻ REFRESH
            </button>}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", alignSelf: "center", letterSpacing: 1 }}>POPULER:</span>
            {POPULAR.map(t => {
              const h = history.find(x => x.ticker === t);
              return (
                <button key={t} onClick={() => { setInputVal(t); scan(t); }}
                  style={{ padding: "3px 9px", borderRadius: 6, background: ticker === t ? "rgba(245,200,66,0.14)" : "rgba(255,255,255,0.04)", border: `1px solid ${ticker === t ? "rgba(245,200,66,0.35)" : "rgba(255,255,255,0.07)"}`, color: h ? h.color : ticker === t ? "#f5c842" : "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 8, cursor: "pointer" }}>
                  {t}{h ? ` ${h.comp}` : ""}
                </button>
              );
            })}
          </div>

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <div style={{ width: 13, height: 13, border: "2px solid rgba(245,200,66,0.2)", borderTop: "2px solid #f5c842", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 10, color: "#f5c842", animation: "blink 1.2s ease infinite", letterSpacing: 1 }}>{loadMsg}</span>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 10, padding: "9px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, fontSize: 10, color: "#f87171", wordBreak: "break-word", lineHeight: 1.7 }}>
              ⚠ {error}<br />
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>Pastikan kode benar (contoh: BBCA bukan BBCA.JK) · Coba lagi atau cek koneksi internet</span>
            </div>
          )}
        </div>

        {/* HISTORY */}
        {history.length > 0 && (
          <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", alignSelf: "center", letterSpacing: 1 }}>RIWAYAT:</span>
            {history.map(h => (
              <button key={h.ticker} onClick={() => { setInputVal(h.ticker); scan(h.ticker); }}
                style={{ padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontFamily: "monospace", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: h.sc, fontSize: 7 }}>●</span>
                <span>{h.ticker}</span>
                <span style={{ color: h.color, fontWeight: 700 }}>{h.comp}</span>
              </button>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!data && !loading && !error && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <div style={{ textAlign: "center", padding: "10px 20px 20px", color: "rgba(255,255,255,0.1)" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "rgba(255,255,255,0.15)", marginBottom: 6 }}>Masukkan kode saham untuk memindai</div>
              <div style={{ fontSize: 8, letterSpacing: 3 }}>ATAU JELAJAHI RADAR OTOMATIS DI BAWAH INI</div>
            </div>

            {exploreData ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 30 }}>
                {[
                  { title: "🔥 AKUMULASI (STRONG BUY)", data: exploreData.strongBuy, color: "#00ff88" },
                  { title: "💎 CALON MULTIBAGGER", data: exploreData.multibagger, color: "#22d3ee" },
                  { title: "📈 TOP GAINERS HARI INI", data: exploreData.topGainers, color: "#4ade80" },
                  { title: "💥 VOLUME TERAKTIF", data: exploreData.active, color: "#a78bfa" }
                ].map(grp => (
                  <div key={grp.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 9, color: grp.color, letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{grp.title}</div>
                    {grp.data.map(item => (
                      <div key={item.ticker} onClick={() => { setInputVal(item.ticker); scan(item.ticker); }}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, cursor: "pointer", transition: "background 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                        onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{item.ticker}</span>
                          <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
                        </div>
                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: item.chg >= 0 ? "#4ade80" : "#f87171" }}>
                            {item.chg > 0 ? "+" : ""}{item.chg?.toFixed(1)}%
                          </span>
                          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{item.price?.toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px", fontSize: 10, color: "rgba(255,255,255,0.2)", animation: "pulse 1.5s infinite" }}>Memindai Radar Pasar...</div>
            )}
          </div>
        )}

        {/* ─── RESULTS ─────────────────────────────────────────────────── */}
        {data && !loading && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>

            {/* Row 1: Score + Price */}
            <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ background: `${grade.color}0d`, border: `1.5px solid ${grade.color}28`, borderRadius: 14, padding: 16, textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 0%,${grade.color}12,transparent 60%)`, pointerEvents: "none" }} />
                <div style={{ fontSize: 7, letterSpacing: 3, color: `${grade.color}60`, marginBottom: 5 }}>COMPOSITE SCORE</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 60, fontWeight: 900, color: grade.color, lineHeight: 1, textShadow: `0 0 35px ${grade.color}40` }}>{sc.comp}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", marginBottom: 10 }}>/100</div>
                <div style={{ display: "inline-block", padding: "5px 16px", borderRadius: 100, background: `${grade.color}15`, border: `1.5px solid ${grade.color}50`, fontSize: 9, fontWeight: 700, color: grade.color, letterSpacing: 2 }}>
                  {grade.icon} {grade.label}
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: `${sCol}bb`, letterSpacing: 1 }}>{ticker}.JK</div>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", marginTop: 2, lineHeight: 1.4 }}>{data.name}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignContent: "start" }}>
                <StatBox label="HARGA TERAKHIR" value={`Rp ${fmt(data.currentPrice)}`}
                  sub={`${chPct >= 0 ? "+" : ""}${fmtDec(chPct)}% · Vol ${(data.todayVol / 1e6).toFixed(1)}M`}
                  color={chPct >= 0 ? "#4ade80" : "#f87171"} hi />
                {/* FIX: was data.currentHigh/currentLow — now correctly dayHigh/dayLow */}
                <StatBox label="OPEN / HIGH / LOW"
                  value={`${fmt(data.currentOpen)}`}
                  sub={`H: ${fmt(data.dayHigh)} · L: ${fmt(data.dayLow)}`} />
                <StatBox label="52W HIGH / LOW"
                  value={`${fmt(data.high52w)}`}
                  sub={`Low: ${fmt(data.low52w)}`}
                  color={data.currentPrice < data.high52w * 0.8 ? "#4ade80" : "#fb923c"} />
                <StatBox label="P/E RATIO" value={`${fmtDec(data.pe, 1)}×`} sub={`Sektor avg ${ref.pe}×`}
                  color={data.pe > 0 && data.pe <= ref.pe ? "#4ade80" : "#fb923c"} />
                <StatBox label="P/BV" value={`${fmtDec(data.pbv, 2)}×`} sub={`Sektor avg ${ref.pbv}×`}
                  color={data.pbv > 0 && data.pbv <= ref.pbv ? "#4ade80" : "#fb923c"} />
                <StatBox label="DIV YIELD" value={`${fmtDec(data.divYield, 2)}%`} color="#fbbf24" />
              </div>
            </div>

            {/* Row 2: Chart */}
            <div style={{ ...card, padding: "14px 12px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3 }}>◈ CHART 60 HARI — CANDLESTICK REAL DATA</div>
                <div style={{ display: "flex", gap: 12, fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
                  <span>MA20 <span style={{ color: "#f5c842" }}>━</span></span>
                  <span>MA50 <span style={{ color: "#60a5fa" }}>╌</span></span>
                </div>
              </div>
              {/* FIX: was data.macdHist (now correctly macdHistArr) */}
              <PriceChart data={data.chartData} ticker={ticker} macdHistArr={data.macdHistArr || []} />
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 8, color: "rgba(255,255,255,0.25)", flexWrap: "wrap" }}>
                <span>MA20: <span style={{ color: "#f5c842", fontWeight: 700 }}>Rp {fmt(data.ma20)}</span></span>
                <span>MA50: <span style={{ color: "#60a5fa", fontWeight: 700 }}>Rp {fmt(data.ma50)}</span></span>
                {data.ma200 > 0 && <span>MA200: <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>Rp {fmt(data.ma200)}</span></span>}
                <span>Bollinger: <span style={{ color: "rgba(255,255,255,0.4)" }}>Upper {fmt(data.boll_upper)} · Lower {fmt(data.boll_lower)}</span></span>
              </div>
            </div>

            {/* Row 3: 3 Pillars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={card}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 14 }}>◈ SKOR 3 PILAR</div>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <ArcMeter value={sc.fund} color="#f5c842" label="Fundamental" />
                  <ArcMeter value={sc.tech} color="#38bdf8" label="Technical" />
                  <ArcMeter value={sc.band} color="#a78bfa" label="Tekanan Harga" />
                </div>
                <div style={{ marginTop: 10, fontSize: 7, color: "rgba(255,255,255,0.18)", textAlign: "center" }}>
                  Bobot: Fund 45% · Tech 30% · Tekanan Harga 25%
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 12 }}>◈ FUNDAMENTAL vs SEKTOR {(data.sector || "").toUpperCase()}</div>
                {[
                  { l: "P/E", y: nf(data.pe), a: ref.pe, lb: true },
                  { l: "PBV", y: nf(data.pbv), a: ref.pbv, lb: true },
                  { l: "DER", y: nf(data.der), a: ref.der, lb: true },
                  { l: "ROE%", y: nf(data.roe), a: 12, lb: false },
                ].map(({ l, y, a, lb }) => {
                  const better = lb ? y <= a && y > 0 : y >= a;
                  const pct = a > 0 ? Math.round(Math.abs(y - a) / a * 100) : 0;
                  const fill = better ? "#4ade80" : "#fb923c";
                  return (
                    <div key={l} style={{ marginBottom: 9 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 3 }}>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>{l}</span>
                        <span style={{ color: fill }}>{y > 0 ? (better ? `✓ ${pct}% lebih baik` : `⚠ ${pct}% lebih mahal`) : "N/A"}</span>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (y / (a * 2.2)) * 100)}%`, background: fill, borderRadius: 2, transition: "width 1s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>
                        <span>{fmtDec(y, 2)}×</span><span>avg {a}×</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 🤖 AI FUND MANAGER ── */}
            <AiFundManagerPanel
              result={fundManagerResult}
              loading={fundManagerLoading}
              onRefresh={() => fetchAiFundManager(ticker, data, calcScores(data, data.sector), geminiKey, setFundManagerResult, setFundManagerLoading)}
            />

            {/* Row 4: Fundamental Detail */}
            <div style={card}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 12 }}>◈ DATA FUNDAMENTAL — LAPORAN KEUANGAN TERBARU</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
                {[
                  { l: "ROE", v: `${fmtDec(data.roe, 1)}%`, c: data.roe >= 15 ? "#4ade80" : "rgba(255,255,255,0.7)" },
                  { l: "ROA", v: `${fmtDec(data.roa, 1)}%`, c: data.roa >= 8 ? "#4ade80" : "rgba(255,255,255,0.7)" },
                  { l: "EPS", v: `Rp ${fmt(data.eps)}`, c: "rgba(255,255,255,0.8)" },
                  { l: "EPS Growth", v: `${fmtDec(data.epsGrowth, 1)}%`, c: data.epsGrowth >= 10 ? "#4ade80" : data.epsGrowth >= 0 ? "#fbbf24" : "#f87171" },
                  { l: "Mkt Cap", v: data.marketCap >= 1e12 ? `${(data.marketCap / 1e12).toFixed(1)}T` : `${(data.marketCap / 1e9).toFixed(0)}M`, c: "rgba(255,255,255,0.7)" },
                  { l: "Net Income", v: data.netIncome >= 1e12 ? `${(data.netIncome / 1e12).toFixed(1)}T` : `${(data.netIncome / 1e9).toFixed(0)}M`, c: "rgba(255,255,255,0.7)" },
                  { l: "DER", v: `${fmtDec(data.der, 2)}×`, c: data.der < 1 ? "#4ade80" : data.der < 1.5 ? "#fbbf24" : "#f87171" },
                  { l: "Target Analis", v: data.targetPrice > 0 ? `Rp ${fmt(data.targetPrice)}` : "—", c: data.targetPrice > data.currentPrice ? "#4ade80" : "rgba(255,255,255,0.5)" },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
              {data.analystCount > 0 && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(245,200,66,0.06)", borderRadius: 8, fontSize: 9, color: "rgba(255,255,255,0.4)", borderLeft: "2px solid rgba(245,200,66,0.3)" }}>
                  📊 Konsensus TradingView: <span style={{ color: "#f5c842", fontWeight: 700, textTransform: "uppercase" }}>{data.analystRec}</span>
                </div>
              )}
            </div>

            {/* TradingView Multi-Timeframe */}
            {data.tvAdvice && (
              <div style={{ ...card, background: "linear-gradient(145deg, rgba(255,255,255,0.02), rgba(245,200,66,0.04))", border: "1px solid rgba(245,200,66,0.15)", padding: "16px 14px" }}>
                <div style={{ fontSize: 9, color: "rgba(245,200,66,0.6)", letterSpacing: 3, marginBottom: 14 }}>◈ SARAN EKSKUSI TIGA HORIZON — TRADINGVIEW AI</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, textAlign: "center" }}>
                  {[
                    { l: "SCALPING", t: "15 Menit", v: data.tvAdvice.scalping },
                    { l: "INTRADAY", t: "1 Jam", v: data.tvAdvice.intraday },
                    { l: "SWING", t: "Harian", v: data.tvAdvice.swing },
                    { l: "INVEST/HOLD", t: "Mingguan", v: data.tvAdvice.invest },
                  ].map(({ l, t, v }) => {
                    const isBuy = v.includes("BUY"), isSell = v.includes("SELL");
                    const c = isBuy ? "#4ade80" : isSell ? "#f87171" : "#fbbf24";
                    return (
                      <div key={l} style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.01), ${c}15)`, border: `1px solid ${c}30`, borderRadius: 10, padding: "12px 6px" }}>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5, marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{v}</div>
                        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", marginTop: 5, fontStyle: "italic" }}>{t}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Technical Analysis */}
            <div style={card}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 14 }}>◈ ANALISIS TEKNIKAL — DIHITUNG DARI CANDLESTICK 2 TAHUN</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  {/* RSI */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9 }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>RSI (14) — Wilder's</span>
                      <span style={{ color: data.rsi < 30 ? "#00ff88" : data.rsi > 70 ? "#f87171" : "#94a3b8", fontWeight: 700, letterSpacing: 1 }}>
                        {data.rsi} · {data.rsi < 30 ? "OVERSOLD ↑" : data.rsi > 70 ? "OVERBOUGHT ↓" : "NORMAL"}
                      </span>
                    </div>
                    <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", background: "rgba(74,222,128,0.15)" }} />
                      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", background: "rgba(248,113,113,0.15)" }} />
                      <div style={{ height: "100%", width: `${data.rsi}%`, background: "linear-gradient(90deg,#4ade80 0%,#fbbf24 50%,#f87171 100%)", borderRadius: 4, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                      <span>0 Oversold</span><span>30 — 70</span><span>Overbought 100</span>
                    </div>
                  </div>

                  {/* MACD */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>MACD (12,26,9)</div>
                    {[
                      { l: "MACD Line", v: fmtDec(data.macdValue, 2), c: data.macdValue > 0 ? "#4ade80" : "#f87171" },
                      { l: "Signal Line", v: fmtDec(data.macdSig, 2), c: "rgba(255,255,255,0.6)" },
                      // FIX: was data.macdHist (now correctly macdHistValue = scalar)
                      { l: "Histogram", v: fmtDec(data.macdHistValue, 2), c: data.macdHistValue > 0 ? "#4ade80" : "#f87171" },
                      { l: "Sinyal", v: ({ bullish_cross: "🟢 BULLISH CROSS", above_signal: "🟡 DI ATAS SIGNAL", neutral: "⚪ NETRAL", bearish: "🔴 BEARISH" })[data.macdSignal] || data.macdSignal, c: data.macdSignal === "bullish_cross" ? "#00ff88" : data.macdSignal === "bearish" ? "#f87171" : "rgba(255,255,255,0.7)" },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 9 }}>
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>{l}</span>
                        <span style={{ color: c, fontFamily: "monospace", fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {/* Moving Averages */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>MOVING AVERAGES</div>
                    {[
                      { l: "Harga vs MA20", price: data.currentPrice, ma: data.ma20 },
                      { l: "Harga vs MA50", price: data.currentPrice, ma: data.ma50 },
                      ...(data.ma200 > 0 ? [{ l: "Harga vs MA200", price: data.currentPrice, ma: data.ma200 }] : []),
                    ].map(({ l, price, ma }) => {
                      const above = price >= ma;
                      const diff = ma > 0 ? ((price - ma) / ma * 100) : 0;
                      return (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 9 }}>
                          <span style={{ color: "rgba(255,255,255,0.35)" }}>{l}</span>
                          <span style={{ color: above ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>
                            {above ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}% · {fmt(ma)}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 9 }}>
                      <span style={{ color: "rgba(255,255,255,0.35)" }}>Golden/Death Cross</span>
                      <span style={{ color: data.ma20Above50 ? "#00ff88" : "#f87171", fontFamily: "monospace", fontWeight: 700 }}>
                        {data.ma20Above50 ? "🟢 GOLDEN CROSS" : "🔴 DEATH CROSS"}
                      </span>
                    </div>
                  </div>

                  {/* Support & Resistance */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>SUPPORT & RESISTANCE</div>
                    {[
                      { l: "Resisten Kuat (R2)", v: `Rp ${fmt(data.swingH)}`, c: "rgba(248,113,113,0.9)", sub: "High 20 Hari" },
                      { l: "Resisten Dekat (R1)", v: `Rp ${fmt(Math.round(data.r1))}`, c: "rgba(251,146,60,0.9)", sub: "Pivot Harian" },
                      { l: "Titik Tengah Pivot (P)", v: `Rp ${fmt(Math.round(data.pivotP))}`, c: "rgba(255,255,255,0.6)", sub: "" },
                      { l: "Support Dekat (S1)", v: `Rp ${fmt(Math.round(data.s1))}`, c: "rgba(74,222,128,0.9)", sub: "Pivot Harian" },
                      { l: "Support Kuat (S2)", v: `Rp ${fmt(data.swingL)}`, c: "rgba(0,255,136,0.9)", sub: "Low 20 Hari" },
                    ].map(({ l, v, c, sub }) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 9, alignItems: "center" }}>
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>{l}</span>
                        <span style={{ color: c, fontFamily: "monospace", fontWeight: 700 }}>
                          {v} {sub && <span style={{ color: "rgba(255,255,255,0.2)", marginLeft: 4, fontWeight: 400, fontSize: 8 }}>{sub}</span>}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Volume + Bollinger */}
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>VOLUME & BOLLINGER</div>
                    {[
                      { l: "Volume Hari Ini", v: `${(data.todayVol / 1e6).toFixed(1)}M`, sub: `avg20: ${(data.avgVol20 / 1e6).toFixed(1)}M`, c: data.volumeBreakout ? "#00ff88" : "rgba(255,255,255,0.6)" },
                      { l: "Vol vs Rata2", v: `${(data.todayVol / data.avgVol20 * 100).toFixed(0)}%`, c: data.volumeBreakout ? "#00ff88" : "rgba(255,255,255,0.6)" },
                      { l: "Bollinger Upper", v: `Rp ${fmt(data.boll_upper)}`, c: "rgba(255,255,255,0.5)" },
                      { l: "Bollinger Lower", v: `Rp ${fmt(data.boll_lower)}`, c: data.currentPrice <= data.boll_lower * 1.02 ? "#4ade80" : "rgba(255,255,255,0.5)" },
                    ].map(({ l, v, sub, c }) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 9, flexWrap: "wrap", gap: 2 }}>
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>{l}</span>
                        <span style={{ color: c, fontFamily: "monospace" }}>{v}{sub ? <span style={{ color: "rgba(255,255,255,0.2)", marginLeft: 4, fontSize: 8 }}>{sub}</span> : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* FIX: Trading Plan is now OUTSIDE the Technical Analysis div (was incorrectly nested inside before) */}

            {/* ── 📰 NEWS SENTIMENT (Pilar Ketiga) ── */}
            <NewsSentimentPanel
              headlines={headlines}
              newsLoading={newsLoading}
              sentiment={sentiment}
              sentimentLoading={sentimentLoading}
              hasKey={!!geminiKey}
            />

            {/* ── 🛡️ FLEXIBLE TRADING PLAN ── */}
            <FlexibleTradingPlan
              data={data}
              avgEntry={avgEntry}
              tgt={tgt}
              cl={cl}
              rr={rr}
              rrOk={rrOk}
            />

            {/* Signal summary */}
            <div style={{ ...card, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 10 }}>◈ SINYAL AKTIF SAAT INI</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { cond: data.rsi < 30, txt: "RSI Oversold — Harga menukik tajam, potensi reversal teknikal", c: "#4ade80" },
                  { cond: data.rsi > 70, txt: "RSI Overbought — Harga rawan koreksi, hindari kejar pucuk", c: "#fb923c" },
                  { cond: data.macdSignal === "bullish_cross", txt: "MACD Bullish Cross — Momentum pembeli menguat", c: "#4ade80" },
                  { cond: data.macdSignal === "bearish", txt: "MACD Bearish Cross — Momentum penjual dominan", c: "#f87171" },
                  { cond: data.ma20Above50 && data.currentPrice > data.ma50, txt: "MA Golden Cross Aktif — Konfirmasi uptrend menengah", c: "#4ade80" },
                  { cond: data.ma20Above50 && data.currentPrice <= data.ma50, txt: "Waspada GC Palsu: Harga anjlok di bawah MA50", c: "#f87171" },
                  { cond: !data.ma20Above50, txt: "MA Death Cross — Konfirmasi fase downtrend", c: "#fb923c" },
                  { cond: data.volumeBreakout && data.currentPrice >= data.currentOpen, txt: `Volume Akumulasi Masif! (${(data.todayVol / data.avgVol20).toFixed(1)}× Rata-rata)`, c: "#00ff88" },
                  { cond: data.volumeBreakout && data.currentPrice < data.currentOpen, txt: `Volume Distribusi/Buangan! (${(data.todayVol / data.avgVol20).toFixed(1)}× Rata-rata)`, c: "#f87171" },
                  { cond: data.currentPrice <= data.boll_lower * 1.02, txt: "Harga menabrak Bollinger Bawah — Potensi mantul (Rebound)", c: "#4ade80" },
                ].filter(s => s.cond).map((s, i) => (
                  <div key={i} style={{ fontSize: 9, color: s.c, padding: "5px 10px", background: `${s.c}10`, borderRadius: 6, border: `1px solid ${s.c}25` }}>
                    {s.c === "#f87171" || s.c === "#fb923c" ? "⚠" : "✓"} {s.txt}
                  </div>
                ))}
                {[data.rsi < 30, data.rsi > 70, data.macdSignal === "bullish_cross", data.macdSignal === "bearish", data.ma20Above50, !data.ma20Above50, data.volumeBreakout, data.currentPrice <= data.boll_lower * 1.02].every(v => !v) && (
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", padding: "8px", gridColumn: "1/-1", textAlign: "center" }}>
                    Tidak ada sinyal kuat yang aktif saat ini — Saham dalam fase konsolidasi
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 💬 FLOATING CHAT BUTTON + CHATBOX ── */}
      {data && !loading && (
        <>
          <button onClick={() => setChatOpen(!chatOpen)}
            style={{ position: "fixed", bottom: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: chatOpen ? "#f5c842" : "linear-gradient(135deg,#f5c842,#f5a030)", border: "none", color: chatOpen ? "#000" : "#000", fontSize: 20, cursor: "pointer", zIndex: 1001, boxShadow: "0 4px 20px rgba(245,200,66,0.4)", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }}
            title={`Tanya AI tentang ${ticker}`}>
            {chatOpen ? "✕" : "💬"}
          </button>
          <SmartChatbox ticker={ticker} data={data} apiKey={geminiKey} open={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
        </>
      )}
    </div>
  );
}
