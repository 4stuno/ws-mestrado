import type { ScenarioOption } from "@/lib/types";

const TECHNIQUE_KEYS = [
  "multilevel",
  "coalescing_repeating",
  "coalescing_hidden",
  "spell",
  "tf",
] as const;

type TechniqueKey = (typeof TECHNIQUE_KEYS)[number];

const TECHNIQUE_LABELS: Record<TechniqueKey, string> = {
  multilevel: "Dividir o prazo em início e fim",
  coalescing_repeating: "Remover eventos repetidos em sequência",
  coalescing_hidden: "Ocultar passos intermediários (vis → try → sub)",
  spell: "Resumir repetições longas (algumas / muitas)",
  tf: "Separar em sessões de estudo (pausa maior que 1 h)",
};

const TECHNIQUE_SHORT: Record<TechniqueKey, string> = {
  multilevel: "fases do prazo",
  coalescing_repeating: "sem repetições",
  coalescing_hidden: "ocultar intermediários",
  spell: "resumo de repetições",
  tf: "sessões de estudo",
};

function activeTechniques(s: ScenarioOption): TechniqueKey[] {
  const fromFlags = TECHNIQUE_KEYS.filter((k) => s[k] === true);
  if (fromFlags.length > 0 || s.id === 0) return fromFlags;
  return parseTechniquesFromLabel(s.label);
}

/** Fallback quando a API não envia as flags booleanas (ex.: schema antigo). */
function parseTechniquesFromLabel(label: string): TechniqueKey[] {
  const lower = label.toLowerCase();
  const found: TechniqueKey[] = [];
  if (lower.includes("níveis temporais") || lower.includes("fases do prazo")) found.push("multilevel");
  if (lower.includes("sem repetições")) found.push("coalescing_repeating");
  if (lower.includes("ocultar intermediários")) found.push("coalescing_hidden");
  if (lower.includes("spell") || lower.includes("resumo de repetições")) found.push("spell");
  if (lower.includes("sessões")) found.push("tf");
  return found;
}

export function scenarioDisplayName(s: ScenarioOption, defaultId = 7): string {
  const active = activeTechniques(s);
  if (active.length === 0) {
    if (s.id === 0) return "Sequência original (sem simplificação)";
    const cleaned = s.label
      .replace(/^\d+-[\w_]+\s*[—–-]\s*/i, "")
      .replace(/\s*—\s*baseline$/i, "")
      .trim();
    return cleaned || `Cenário ${s.id}`;
  }
  const short = active.map((k) => TECHNIQUE_SHORT[k]).join(" + ");
  if (s.id === defaultId) return `${short} (recomendado)`;
  return short;
}

export function scenarioDescription(s: ScenarioOption): string {
  const active = activeTechniques(s);
  if (active.length === 0) {
    return "Mostra todos os eventos na ordem em que ocorreram, sem nenhuma técnica de simplificação.";
  }
  return active.map((k) => TECHNIQUE_LABELS[k]).join(" · ");
}

export function scenarioGroup(s: ScenarioOption, defaultId = 7): string {
  if (s.id === defaultId) return "Recomendado";
  const active = activeTechniques(s);
  if (active.length === 0) return "Sem simplificação";
  if (active.length === 1) return "Uma técnica";
  if (s.tf && s.spell) return "Sessões + resumo de repetições";
  if (s.tf) return "Com sessões de estudo";
  if (s.spell) return "Com resumo de repetições";
  if (s.multilevel) return "Com fases do prazo";
  return "Combinações";
}

export function buildScenarioSelectData(
  scenarios: ScenarioOption[],
  defaultId = 7,
): { group: string; items: { value: string; label: string }[] }[] {
  const grouped = new Map<string, { value: string; label: string }[]>();

  for (const s of scenarios) {
    const group = scenarioGroup(s, defaultId);
    const items = grouped.get(group) ?? [];
    items.push({ value: String(s.id), label: scenarioDisplayName(s, defaultId) });
    grouped.set(group, items);
  }

  const order = [
    "Recomendado",
    "Sem simplificação",
    "Uma técnica",
    "Com fases do prazo",
    "Com resumo de repetições",
    "Com sessões de estudo",
    "Sessões + resumo de repetições",
    "Combinações",
  ];

  return order
    .filter((g) => grouped.has(g))
    .map((group) => ({ group, items: grouped.get(group)! }));
}

export function findScenario(scenarios: ScenarioOption[] | undefined, id: number): ScenarioOption | undefined {
  return scenarios?.find((s) => s.id === id);
}
