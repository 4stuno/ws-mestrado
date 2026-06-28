"""Motor de storytelling: regras R4–R44 e pacotes visuais."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from app.config import FLOW_SEQUENCE, settings


@dataclass
class StoryRule:
    id: str
    category: str
    title: str
    question_template: str
    highlight: str  # risk | good | attention
    min_impact_pct: float = 0.02


STORY_CATALOG: list[StoryRule] = [
    StoryRule("R4", "deadline", "Inatividade antes do fechamento",
              "Quem ficou inativo nos {n_days} dias anteriores ao fechamento teve desempenho significativamente menor?",
              "risk", 0.03),
    StoryRule("R5", "deadline", "Submissão sem preparação prévia",
              "Quem submeteu sem resource_vis nos {prep_days} dias antes da entrega?",
              "risk", 0.05),
    StoryRule("R6", "deadline", "Primeira tentativa na última hora",
              "Nas últimas {late_hours}h antes do prazo, quantos iniciaram a primeira tentativa?",
              "attention", 0.05),
    StoryRule("R7", "bottleneck", "Visualizou mas nunca tentou",
              "Quem chegou à atividade mas não iniciou a tentativa?",
              "attention", 0.02),
    StoryRule("R19", "deadline", "Entrada tardia no curso",
              "Quantos alunos só começaram após a primeira semana?",
              "attention", 0.05),
    StoryRule("R21", "bottleneck", "Demora entre visualizar e tentar",
              "Há vários dias entre visualizar e iniciar a atividade?",
              "attention", 0.03),
    StoryRule("R27", "deadline", "Longos períodos sem acesso",
              "Hiatos longos de atividade aparecem como sinal de risco?",
              "risk", 0.05),
    StoryRule("R30", "bottleneck", "Tentou mas não submeteu",
              "Quem iniciou atividades mas não chegou à submissão?",
              "attention", 0.03),
    StoryRule("R32", "prep", "Fluxo ideal incompleto",
              "Quem não percorre todas as etapas antes da submissão?",
              "attention", 0.05),
    StoryRule("R33", "deadline", "Correria nas últimas 48h",
              "Boa parte da atividade concentrou-se nas últimas 48h?",
              "attention", 0.10),
    StoryRule("R34", "deadline", "Pico de acessos nos últimos dias",
              "O volume de acessos triplicou nos dias finais?",
              "attention", 0.10),
    StoryRule("R35", "deadline", "Alunos só na segunda metade do prazo",
              "Uma parcela só iniciou na reta final?",
              "attention", 0.05),
    StoryRule("R37", "prep", "Revisita aos materiais após submissão",
              "Grande parte revisitou materiais depois da submissão?",
              "good", 0.05),
    StoryRule("R41", "profile", "Perfil de correria recorrente",
              "Padrão recorrente de correria próximo ao prazo?",
              "risk", 0.03),
    StoryRule("R43", "profile", "Perfil preparado e antecipado",
              "Preparação antecipada como caminho estável?",
              "good", 0.05),
    StoryRule("R44", "profile", "Perfil de risco silencioso",
              "Baixo engajamento próximo aos prazos indica evasão?",
              "risk", 0.05),
]


def _base_class(ev: str) -> str:
    for suffix in ("_START", "_END", "_SOME", "_MANY"):
        ev = ev.replace(suffix, "")
    return ev


def adherence_score(events: list[dict], flow: list[str] | None = None) -> float:
    flow = flow or FLOW_SEQUENCE
    seen = {_base_class(e["event"]) for e in events}
    done = sum(1 for step in flow if step in seen)
    return done / len(flow) if flow else 0.0


def evaluate_stories(
    user_sequences: list[dict],
    activity_df: pd.DataFrame,
    quiz: dict,
    user_metrics: dict[int, dict],
    thresholds: dict | None = None,
) -> dict[str, Any]:
    th = thresholds or {}
    low = th.get("low_grade", settings.low_grade)
    late_h = th.get("late_try_hours", settings.late_try_hours)
    inact_d = th.get("inactivity_days", settings.inactivity_days)
    prep_d = th.get("resource_prep_days", settings.resource_prep_days) * 86400

    t_close = quiz["t_close"]
    t_open = quiz["t_open"]
    window = t_close - t_open
    half = t_open + window / 2
    last_48h = t_close - 48 * 3600
    last_24h = t_close - late_h * 3600
    week1 = t_open + 7 * 86400
    inact_window = t_close - inact_d * 86400

    total = max(len(user_sequences), 1)
    affected: dict[str, set[int]] = {r.id: set() for r in STORY_CATALOG}

    for us in user_sequences:
        uid = int(us["key"])
        flat: list[dict] = []
        for sess in us["events"]:
            flat.extend(sess)

        classes = [_base_class(e["event"]) for e in flat]
        times = [e["time"] for e in flat]

        # R4 inatividade pré-deadline
        relevant = [t for e, t in zip(classes, times) if e in ("assignment_vis", "assignment_try", "assignment_sub", "resource_vis")]
        if relevant and max(relevant) < inact_window:
            affected["R4"].add(uid)

        # R5 sub sem prep
        subs = [e for e in flat if _base_class(e["event"]) == "assignment_sub"]
        for sub in subs:
            prep = [e for e in flat if _base_class(e["event"]) == "resource_vis" and sub["time"] - prep_d <= e["time"] < sub["time"]]
            if not prep:
                affected["R5"].add(uid)
                break

        # R6 primeira try última hora
        tries = [e for e in flat if _base_class(e["event"]) == "assignment_try"]
        if tries and min(t["time"] for t in tries) >= last_24h:
            affected["R6"].add(uid)

        # R7 vis sem try
        if "assignment_vis" in classes and "assignment_try" not in classes:
            affected["R7"].add(uid)

        # R19 entrada tardia
        if times and min(times) > week1:
            affected["R19"].add(uid)

        # R21 demora vis→try
        vis_t = [e["time"] for e in flat if _base_class(e["event"]) == "assignment_vis"]
        try_t = [e["time"] for e in flat if _base_class(e["event"]) == "assignment_try"]
        if vis_t and try_t and (min(try_t) - min(vis_t)) > 3 * 86400:
            affected["R21"].add(uid)

        # R27 hiato > 7 dias
        for i in range(1, len(times)):
            if times[i] - times[i - 1] > 7 * 86400:
                affected["R27"].add(uid)
                break

        # R30 try sem sub
        if "assignment_try" in classes and "assignment_sub" not in classes:
            affected["R30"].add(uid)

        # R32 fluxo incompleto
        if adherence_score(flat) < 0.6:
            affected["R32"].add(uid)

        # R33 atividade últimas 48h
        if times and sum(1 for t in times if t >= last_48h) >= len(times) * 0.5:
            affected["R33"].add(uid)

        # R35 só segunda metade
        if times and min(times) > half:
            affected["R35"].add(uid)

        # R37 resource após sub
        if subs:
            sub_t = subs[0]["time"]
            if any(_base_class(e["event"]) == "resource_vis" and e["time"] > sub_t for e in flat):
                affected["R37"].add(uid)

        # R41 correria: >60% eventos em últimas 48h e média baixa
        m = user_metrics.get(uid, {})
        if times and sum(1 for t in times if t >= last_48h) / len(times) > 0.6 and m.get("mean_ratio", 1) < low:
            affected["R41"].add(uid)

        # R43 preparado: try antes da metade + aderência alta
        if tries and min(t["time"] for t in tries) < half and adherence_score(flat) >= 0.8:
            affected["R43"].add(uid)

        # R44 risco silencioso: poucos eventos + segmento risk
        if len(flat) < 5 and m.get("segment") == "risk":
            affected["R44"].add(uid)

    # R34 pico turma — agregado nos logs
    act_logs = activity_df
    if not act_logs.empty and "t" in act_logs.columns:
        last_days = act_logs[act_logs["t"] >= last_48h]
        prior = act_logs[(act_logs["t"] >= t_open) & (act_logs["t"] < last_48h)]
        if len(prior) > 0 and len(last_days) > 2.5 * (len(prior) / max((last_48h - t_open) / 86400, 1)) * 2:
            affected["R34"].add(-1)  # turma

    stories_out: list[dict] = []
    for rule in STORY_CATALOG:
        ids = affected[rule.id] - {-1}
        n = len(ids)
        pct = n / total
        active = pct >= rule.min_impact_pct or (rule.id == "R34" and -1 in affected[rule.id])
        if not active:
            continue
        question = rule.question_template.format(
            n_days=inact_d, prep_days=th.get("resource_prep_days", settings.resource_prep_days),
            late_hours=late_h,
        )
        stories_out.append({
            "id": rule.id,
            "category": rule.category,
            "title": rule.title,
            "question": question,
            "highlight": rule.highlight,
            "affected_count": n,
            "affected_pct": round(pct * 100, 1),
            "affected_users": list(ids)[:500],
        })

    return {
        "stories": stories_out,
        "active_rule_ids": [s["id"] for s in stories_out],
    }
