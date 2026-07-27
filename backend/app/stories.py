"""Motor de storytelling.

Este módulo implementa as 11 narrativas priorizadas para a visualização por
**passos** (ordem na sequência), todas parametrizáveis via ``StoryParams``.

Cada estória é do tipo "tem/não tem o passo X" ou "o passo A veio antes/depois
de B" — exatamente o que a timeline em coordenadas paralelas representa.

As regras temporais antigas (proximidade de prazo, correria, hiatos, perfis
compostos) foram DESATIVADAS por dependerem de data/hora literal, incompatível
com o eixo X por passos. Elas ficam comentadas em ``_LEGACY_TIME_RULES`` logo
abaixo, para referência/reativação futura.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from app.config import FLOW_SEQUENCE, settings


@dataclass
class StoryRule:
    id: str
    category: str  # prep | bottleneck | social | rhythm
    title: str
    question_template: str
    highlight: str  # risk | good | attention
    params: list[str] = field(default_factory=list)  # parâmetros que a influenciam


# ---------------------------------------------------------------------------
# Catálogo ATIVO — 11 estórias por passos (ver tabela de ranking)
# ---------------------------------------------------------------------------
STORY_CATALOG: list[StoryRule] = [
    StoryRule(
        "S1", "prep", "Submissão sem preparação prévia",
        "Mais de um terço das submissões ocorreu sem acesso prévio aos materiais?",
        "risk",
        ["fluxo_ideal", "evento_preparacao", "evento_marco", "modo_analise", "min_impact_pct"],
    ),
    StoryRule(
        "S2", "prep", "Fluxo ideal incompleto",
        "Parte dos alunos não percorre todas as etapas esperadas antes da submissão?",
        "attention",
        ["fluxo_ideal", "modo_aderencia", "limiar_aderencia", "evento_marco", "min_impact_pct"],
    ),
    StoryRule(
        "S3", "bottleneck", "Tentou mas não submeteu",
        "Alguns alunos iniciam atividades mas não chegam à submissão final?",
        "attention",
        ["evento_inicio", "evento_marco", "min_impact_pct"],
    ),
    StoryRule(
        "S4", "prep", "Revisita aos materiais após submissão",
        "Grande parte da turma revisitou os materiais depois da submissão?",
        "good",
        ["evento_marco", "evento_preparacao", "modo_analise", "min_impact_pct"],
    ),
    StoryRule(
        "S5", "bottleneck", "Visualizou mas nunca tentou",
        "Alguns alunos chegam até a atividade, mas não iniciam a tentativa?",
        "attention",
        ["evento_entrada", "evento_inicio", "min_impact_pct"],
    ),
    StoryRule(
        "S6", "rhythm", "Submissão rápida após tentativa",
        "A maioria das submissões acontece logo após a primeira tentativa?",
        "good",
        ["evento_inicio", "evento_marco", "modo_rapidez", "min_impact_pct"],
    ),
    StoryRule(
        "S7", "social", "Submissão sem participação em fórum",
        "Participação no fórum aparece associada a desempenho um pouco melhor?",
        "attention",
        ["evento_marco", "evento_forum", "low_grade", "min_impact_pct"],
    ),
    StoryRule(
        "S8", "social", "Fórum sem entrega posterior",
        "Discussão no fórum nem sempre virou entrega de atividade?",
        "attention",
        ["evento_forum", "evento_marco", "modo_analise", "min_impact_pct"],
    ),
    StoryRule(
        "S9", "prep", "Pouco consumo de material antes da entrega",
        "Há alunos que submetem atividades consumindo poucos materiais de apoio?",
        "attention",
        ["evento_preparacao", "evento_marco", "max_materiais", "fluxo_ideal", "min_impact_pct"],
    ),
    StoryRule(
        "S10", "bottleneck", "Visualizou mas abandonou",
        "Parte da turma abandona o fluxo após visualizar a atividade?",
        "risk",
        ["evento_entrada", "evento_inicio", "evento_marco", "min_impact_pct"],
    ),
    StoryRule(
        "S11", "bottleneck", "Navegação superficial",
        "Há alunos que navegam pelo curso sem chegar às atividades?",
        "attention",
        ["eventos_navegacao", "evento_entrada", "min_eventos_navegacao", "min_impact_pct"],
    ),
]


# ---------------------------------------------------------------------------
# Catálogo LEGADO — DESATIVADO (dependem de tempo literal / proximidade do prazo)
# Mantido comentado para referência. Não é avaliado na visualização por passos.
# ---------------------------------------------------------------------------
# _LEGACY_TIME_RULES = [
#     ("R4",  "deadline", "Inatividade antes do fechamento"),      # usa dias antes do prazo
#     ("R6",  "deadline", "Primeira tentativa na última hora"),    # usa últimas 24h
#     ("R19", "deadline", "Entrada tardia no curso"),              # usa 1ª semana (data)
#     ("R21", "bottleneck", "Demora entre visualizar e tentar"),   # usa duração (dias)
#     ("R27", "deadline", "Longos períodos sem acesso"),           # usa hiato temporal
#     ("R33", "deadline", "Correria nas últimas 48h"),             # usa janela de 48h
#     ("R34", "deadline", "Pico de acessos nos últimos dias"),     # agregado temporal
#     ("R35", "deadline", "Alunos só na segunda metade do prazo"), # usa metade do prazo
#     ("R41", "profile", "Perfil de correria recorrente"),         # composto temporal
#     ("R43", "profile", "Perfil preparado e antecipado"),         # usa antecedência (data)
#     ("R44", "profile", "Perfil de risco silencioso"),            # usa proximidade do prazo
# ]


# ---------------------------------------------------------------------------
# Parâmetros padrão (espelham StoryParams no schema)
# ---------------------------------------------------------------------------
DEFAULT_STORY_PARAMS: dict[str, Any] = {
    "fluxo_ideal": list(FLOW_SEQUENCE),
    "evento_marco": "assignment_sub",
    "evento_preparacao": "resource_vis",
    "evento_entrada": "assignment_vis",
    "evento_inicio": "assignment_try",
    "evento_forum": "forum_participation",
    "eventos_navegacao": ["course_vis", "resource_vis", "forum_vis"],
    "modo_analise": "passos",
    "modo_aderencia": "presenca",
    "limiar_aderencia": 0.6,
    "modo_rapidez": "passos_adjacentes",
    "max_materiais": 1,
    "min_eventos_navegacao": 2,
    "session_gap": 3600,
    "min_impact_pct": 0.02,
}


def _base_class(ev: str) -> str:
    for suffix in ("_START", "_END", "_SOME", "_MANY"):
        ev = ev.replace(suffix, "")
    return ev


def adherence_score(events: list[dict], flow: list[str] | None = None) -> float:
    """Aderência simples (presença de etapas) — usada no campo por aluno da timeline."""
    flow = flow or FLOW_SEQUENCE
    seen = {_base_class(e["event"]) for e in events}
    done = sum(1 for step in flow if step in seen)
    return done / len(flow) if flow else 0.0


def _flow_adherence(prefix_classes: list[str], flow: list[str], mode: str) -> float:
    """Mede o quanto a sequência cumpre o fluxo ideal, segundo o modo escolhido."""
    if not flow:
        return 1.0
    if mode == "presenca":
        seen = set(prefix_classes)
        return sum(1 for step in flow if step in seen) / len(flow)

    # ordem_parcial / ordem_estrita: casa os passos do fluxo na ordem em que aparecem
    pos = 0
    matched = 0
    for step in flow:
        while pos < len(prefix_classes) and prefix_classes[pos] != step:
            pos += 1
        if pos < len(prefix_classes):
            matched += 1
            pos += 1
        elif mode == "ordem_estrita":
            break  # estrita para no primeiro passo ausente (precisa ser prefixo)
    return matched / len(flow)


def _rules_scope(
    p: dict[str, Any], allowed_classes: set[str] | None
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Define como cada regra deve ser avaliada após filtro opcional de classes."""
    rules_cfg: dict[str, dict[str, Any]] = {}
    status_rows: list[dict[str, Any]] = []

    def build_status(
        rule_id: str,
        status: str,
        reason: str | None = None,
        missing_events: list[str] | None = None,
        adapted_fields: list[str] | None = None,
    ) -> dict[str, Any]:
        return {
            "id": rule_id,
            "status": status,
            "reason": reason,
            "missing_events": missing_events or [],
            "adapted_fields": adapted_fields or [],
        }

    for rule in STORY_CATALOG:
        cfg = {"enabled": True, "missing_events": [], "adapted_fields": []}
        rid = rule.id
        if not allowed_classes:
            rules_cfg[rid] = cfg
            status_rows.append(build_status(rid, "active"))
            continue

        required: list[str] = []
        if rid == "S1":
            required = [p["evento_marco"], p["evento_preparacao"]]
        elif rid == "S2":
            flow = [e for e in p["fluxo_ideal"] if e in allowed_classes]
            removed = [e for e in p["fluxo_ideal"] if e not in allowed_classes]
            if removed:
                cfg["adapted_fields"].append("fluxo_ideal")
            if not flow:
                cfg["enabled"] = False
                cfg["missing_events"] = removed
            cfg["flow"] = flow
        elif rid == "S3":
            required = [p["evento_inicio"], p["evento_marco"]]
        elif rid == "S4":
            required = [p["evento_marco"], p["evento_preparacao"]]
        elif rid == "S5":
            required = [p["evento_entrada"], p["evento_inicio"]]
        elif rid == "S6":
            required = [p["evento_inicio"], p["evento_marco"]]
        elif rid == "S7":
            required = [p["evento_marco"], p["evento_forum"]]
        elif rid == "S8":
            required = [p["evento_forum"], p["evento_marco"]]
        elif rid == "S9":
            required = [p["evento_preparacao"], p["evento_marco"]]
        elif rid == "S10":
            required = [p["evento_entrada"], p["evento_inicio"], p["evento_marco"]]
        elif rid == "S11":
            nav = [e for e in p["eventos_navegacao"] if e in allowed_classes]
            removed = [e for e in p["eventos_navegacao"] if e not in allowed_classes]
            if removed:
                cfg["adapted_fields"].append("eventos_navegacao")
            cfg["nav_events"] = set(nav)
            if not nav:
                cfg["enabled"] = False
                cfg["missing_events"] = removed
            required = [p["evento_entrada"]]

        if required:
            missing = sorted({ev for ev in required if ev not in allowed_classes})
            if missing:
                cfg["enabled"] = False
                cfg["missing_events"] = sorted(set(cfg["missing_events"] + missing))

        rules_cfg[rid] = cfg
        if not cfg["enabled"]:
            status_rows.append(
                build_status(
                    rid,
                    "removed",
                    "Eventos obrigatorios da regra nao estao no filtro selecionado.",
                    cfg["missing_events"],
                    cfg["adapted_fields"],
                )
            )
        elif cfg["adapted_fields"]:
            status_rows.append(
                build_status(
                    rid,
                    "adapted",
                    "Regra adaptada para considerar apenas eventos selecionados.",
                    [],
                    cfg["adapted_fields"],
                )
            )
        else:
            status_rows.append(build_status(rid, "active"))

    return rules_cfg, status_rows


def evaluate_stories(
    user_sequences: list[dict],
    activity_df: pd.DataFrame,
    quiz: dict,
    user_metrics: dict[int, dict],
    thresholds: dict | None = None,
    story_params: dict | None = None,
    allowed_classes: set[str] | None = None,
) -> dict[str, Any]:
    th = thresholds or {}
    p = {**DEFAULT_STORY_PARAMS, **(story_params or {})}

    marco = p["evento_marco"]
    prep = p["evento_preparacao"]
    entrada = p["evento_entrada"]
    inicio = p["evento_inicio"]
    forum = p["evento_forum"]
    nav_events = set(p["eventos_navegacao"])
    fluxo = p["fluxo_ideal"]
    mode = p["modo_analise"]
    session_gap = int(p.get("session_gap", 3600))
    prep_window = th.get("resource_prep_days", settings.resource_prep_days) * 86400
    min_impact = float(p.get("min_impact_pct", 0.02))
    low = th.get("low_grade", settings.low_grade)

    total = max(len(user_sequences), 1)
    affected: dict[str, set[int]] = {r.id: set() for r in STORY_CATALOG}
    rules_cfg, rule_status = _rules_scope(p, allowed_classes)
    # notas p/ narrativa de desempenho (S7)
    grades_forum: list[float] = []
    grades_no_forum: list[float] = []

    for us in user_sequences:
        uid = int(us["key"])
        flat: list[dict] = []
        for sess in us["events"]:
            flat.extend(sess)
        flat.sort(key=lambda e: e["time"])

        classes = [_base_class(e["event"]) for e in flat]
        class_set = set(classes)
        if not classes:
            continue

        deduped: list[str] = []
        for c in classes:
            if not deduped or deduped[-1] != c:
                deduped.append(c)

        first_marco_i = classes.index(marco) if marco in class_set else -1
        marco_t = flat[first_marco_i]["time"] if first_marco_i >= 0 else None
        gr = user_metrics.get(uid, {}).get("mean_ratio")

        # -- S1: submissão sem preparação prévia -----------------------------
        if rules_cfg["S1"]["enabled"] and first_marco_i >= 0:
            if mode == "tempo":
                prep_before = any(
                    _base_class(e["event"]) == prep and marco_t - prep_window <= e["time"] < marco_t
                    for e in flat
                )
            else:
                prep_before = prep in classes[:first_marco_i]
            if not prep_before:
                affected["S1"].add(uid)

        # -- S2: fluxo ideal incompleto --------------------------------------
        s2_flow = rules_cfg["S2"].get("flow", fluxo)
        prefix = classes[: first_marco_i + 1] if first_marco_i >= 0 else classes
        if rules_cfg["S2"]["enabled"] and _flow_adherence(prefix, s2_flow, p["modo_aderencia"]) < p["limiar_aderencia"]:
            affected["S2"].add(uid)

        # -- S3: tentou mas não submeteu -------------------------------------
        if rules_cfg["S3"]["enabled"] and inicio in class_set and marco not in class_set:
            affected["S3"].add(uid)

        # -- S4: revisita aos materiais após submissão -----------------------
        if rules_cfg["S4"]["enabled"] and first_marco_i >= 0:
            if mode == "tempo":
                revisit = any(
                    _base_class(e["event"]) == prep and e["time"] > marco_t for e in flat
                )
            else:
                revisit = prep in classes[first_marco_i + 1 :]
            if revisit:
                affected["S4"].add(uid)

        # -- S5: visualizou mas nunca tentou ---------------------------------
        if rules_cfg["S5"]["enabled"] and entrada in class_set and inicio not in class_set:
            affected["S5"].add(uid)

        # -- S6: submissão rápida após tentativa -----------------------------
        if rules_cfg["S6"]["enabled"] and inicio in class_set and marco in class_set:
            if p["modo_rapidez"] == "mesma_sessao":
                inicio_t = flat[classes.index(inicio)]["time"]
                marco_after = [e["time"] for e in flat if _base_class(e["event"]) == marco and e["time"] >= inicio_t]
                if marco_after and (min(marco_after) - inicio_t) <= session_gap:
                    affected["S6"].add(uid)
            else:  # passos_adjacentes
                if inicio in deduped:
                    di = deduped.index(inicio)
                    if di + 1 < len(deduped) and deduped[di + 1] == marco:
                        affected["S6"].add(uid)

        # -- S7: submissão sem participação em fórum -------------------------
        if rules_cfg["S7"]["enabled"] and marco in class_set:
            if forum not in class_set:
                affected["S7"].add(uid)
                if gr is not None:
                    grades_no_forum.append(gr)
            elif gr is not None:
                grades_forum.append(gr)

        # -- S8: fórum sem entrega posterior ---------------------------------
        if rules_cfg["S8"]["enabled"] and forum in class_set:
            first_forum_i = classes.index(forum)
            if mode == "tempo":
                forum_t = flat[first_forum_i]["time"]
                has_sub_after = any(
                    _base_class(e["event"]) == marco and e["time"] >= forum_t for e in flat
                )
            else:
                has_sub_after = marco in classes[first_forum_i:]
            if not has_sub_after:
                affected["S8"].add(uid)

        # -- S9: pouco consumo de material antes da entrega ------------------
        if rules_cfg["S9"]["enabled"] and first_marco_i >= 0:
            n_prep = classes[:first_marco_i].count(prep)
            if n_prep <= p["max_materiais"]:
                affected["S9"].add(uid)

        # -- S10: visualizou mas abandonou -----------------------------------
        if rules_cfg["S10"]["enabled"] and entrada in class_set and inicio not in class_set and marco not in class_set:
            affected["S10"].add(uid)

        # -- S11: navegação superficial --------------------------------------
        s11_nav_events = rules_cfg["S11"].get("nav_events", nav_events)
        n_nav = sum(1 for c in classes if c in s11_nav_events)
        if rules_cfg["S11"]["enabled"] and n_nav >= p["min_eventos_navegacao"] and entrada not in class_set:
            affected["S11"].add(uid)

    # narrativa de desempenho para S7
    forum_delta = None
    if grades_forum and grades_no_forum:
        forum_delta = round(
            sum(grades_forum) / len(grades_forum) - sum(grades_no_forum) / len(grades_no_forum), 3
        )

    stories_out: list[dict] = []
    for rule in STORY_CATALOG:
        if not rules_cfg[rule.id]["enabled"]:
            continue
        ids = affected[rule.id]
        n = len(ids)
        pct = n / total
        if pct < min_impact:
            continue
        question = rule.question_template
        if rule.id == "S7" and forum_delta is not None:
            question += f" (Δ nota ≈ {forum_delta:+.3f}; risco < {low:.0%})"
        stories_out.append({
            "id": rule.id,
            "category": rule.category,
            "title": rule.title,
            "question": question,
            "highlight": rule.highlight,
            "affected_count": n,
            "affected_pct": round(pct * 100, 1),
            "affected_users": list(ids)[:500],
            "params": rule.params,
        })

    return {
        "stories": stories_out,
        "active_rule_ids": [s["id"] for s in stories_out],
        "rule_status": rule_status,
    }
