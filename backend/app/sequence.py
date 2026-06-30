"""Geração de sequências via biblioteca spm-preprocessing."""
from __future__ import annotations

import pandas as pd
from spm import simplify
from spm.sceneries import SCENERY_DEFINITIONS

_FLAG_LABELS = {
    "multilevel": "níveis temporais",
    "spell": "spell",
    "coalescing_repeating": "sem repetições",
    "coalescing_hidden": "ocultar intermediários",
    "tf": "sessões (1h)",
}


def scenario_label(scenario: dict) -> str:
    flags = [_FLAG_LABELS[k] for k in _FLAG_LABELS if scenario.get(k)]
    if not flags:
        return "Sequência original (sem simplificação)"
    return " + ".join(flags)


def list_scenarios() -> list[dict]:
    return [
        {"id": i, "path": s["path"], "label": scenario_label(s), **{k: s[k] for k in _FLAG_LABELS}}
        for i, s in enumerate(SCENERY_DEFINITIONS)
    ]


def prepare_sequences(
    logs: pd.DataFrame,
    mapping: pd.DataFrame,
    scenario_id: int,
    *,
    assignment_id: int | None,
    initial_date: int,
    final_date: int,
    grades_df: pd.DataFrame | None = None,
) -> list[dict]:
    scenario = SCENERY_DEFINITIONS[scenario_id]
    return simplify(
        logs,
        mapping,
        scenario,
        assignment_id=assignment_id,
        initial_date=initial_date,
        final_date=final_date,
        grades_df=grades_df,
    )
