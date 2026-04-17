// ─── GRADING ──────────────────────────────────────────────────────────────────

export const GRADE_MAP = [
  { min: 85, label: "STRONG BUY", color: "#00ff88", icon: "▲▲▲" },
  { min: 70, label: "BUY",        color: "#4ade80", icon: "▲▲"  },
  { min: 55, label: "ACCUMULATE", color: "#fbbf24", icon: "▲"   },
  { min: 40, label: "HOLD",       color: "#94a3b8", icon: "—"   },
  { min: 25, label: "REDUCE",     color: "#fb923c", icon: "▼"   },
  { min: 0,  label: "SELL / AVOID", color: "#f87171", icon: "▼▼▼" },
];

export const getGrade = s => GRADE_MAP.find(g => s >= g.min) || GRADE_MAP.at(-1);
