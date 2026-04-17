// ─── NEWS SOURCE META ─────────────────────────────────────────────────────────

export const SOURCE_META = {
  "Kontan":        { color: "#f97316", flag: "🇮🇩" },
  "Bisnis":        { color: "#22c55e", flag: "🇮🇩" },
  "CNBC Indonesia":{ color: "#3b82f6", flag: "🇮🇩" },
  "Detik":         { color: "#ef4444", flag: "🇮🇩" },
  "Kompas":        { color: "#dc2626", flag: "🇮🇩" },
  "Tempo":         { color: "#8b5cf6", flag: "🇮🇩" },
  "CNN Indonesia": { color: "#b91c1c", flag: "🇮🇩" },
  "IDX":           { color: "#f5c842", flag: "🇮🇩" },
  "Investor":      { color: "#0ea5e9", flag: "🇮🇩" },
  "Market":        { color: "#06b6d4", flag: "🇮🇩" },
  "Yahoo Finance": { color: "#6366f1", flag: "🌐" },
  "Bloomberg":     { color: "#f59e0b", flag: "🌐" },
  "Reuters":       { color: "#ff6600", flag: "🌐" },
};

export function getSourceMeta(publisher) {
  if (!publisher) return { color: "#94a3b8", flag: "🌐" };
  for (const [key, meta] of Object.entries(SOURCE_META)) {
    if (publisher.toLowerCase().includes(key.toLowerCase())) return meta;
  }
  if (
    publisher.includes(".co.id") ||
    publisher.toLowerCase().includes("indonesia") ||
    publisher.endsWith(".id")
  ) {
    return { color: "#34d399", flag: "🇮🇩" };
  }
  return { color: "#94a3b8", flag: "🌐" };
}
