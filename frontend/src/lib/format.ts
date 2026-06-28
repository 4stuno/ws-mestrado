export function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function highlightColor(level: string): string {
  if (level === "risk") return "#fa5252";
  if (level === "good") return "#40c057";
  if (level === "attention") return "#fab005";
  return "#868e96";
}
