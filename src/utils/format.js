// ─── FORMATTING UTILITIES ─────────────────────────────────────────────────────

export const nf = (v, fb = 0) => { const x = parseFloat(v); return isNaN(x) ? fb : x; };
export const fmt = v => Math.round(v ?? 0).toLocaleString("id-ID");
export const fmtDec = (v, d = 2) => nf(v).toFixed(d);
