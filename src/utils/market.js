// ─── MARKET STATUS ────────────────────────────────────────────────────────────

export function getMarketStatus(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const day = wib.getUTCDay();
  const h = wib.getUTCHours(), m = wib.getUTCMinutes();
  const t = h * 60 + m;
  const isFri = day === 5;
  if (day === 0 || day === 6)
    return { open: false, label: "TUTUP", color: "#f87171", sub: "Weekend" };
  if (t >= 8 * 60 + 45 && t < 9 * 60)
    return { open: false, label: "PRE-OPEN", color: "#fbbf24", sub: "08:45–09:00 WIB" };
  if (t >= 9 * 60 && t < (isFri ? 11 * 60 + 30 : 12 * 60))
    return { open: true, label: "SESI 1", color: "#00ff88", sub: isFri ? "09:00–11:30" : "09:00–12:00" };
  if (t >= (isFri ? 11 * 60 + 30 : 12 * 60) && t < (isFri ? 14 * 60 : 13 * 60 + 30))
    return { open: false, label: "ISTIRAHAT", color: "#94a3b8", sub: "Jeda siang" };
  if (t >= (isFri ? 14 * 60 : 13 * 60 + 30) && t < 15 * 60 + 49)
    return { open: true, label: "SESI 2", color: "#00ff88", sub: isFri ? "14:00–15:49" : "13:30–15:49" };
  if (t >= 15 * 60 + 49 && t < 16 * 60)
    return { open: false, label: "POST-CLOSE", color: "#94a3b8", sub: "Setelah close" };
  return { open: false, label: "TUTUP", color: "#f87171", sub: "Di luar jam trading" };
}
