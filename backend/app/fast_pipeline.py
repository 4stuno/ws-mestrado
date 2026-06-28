"""Pipeline otimizado: merge único + groupby por usuário."""
from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from app.event_pipeline import (
    coalescing_hidden,
    coalescing_repeating,
    spell,
    temporal_folding,
)
from app.data_loader import store


def _apply_multilevel(classes: np.ndarray, times: np.ndarray, t_start: int, t_end: int) -> np.ndarray:
    tf = t_start + (t_end - t_start) / 2
    out = np.empty(len(classes), dtype=object)
    for i, (c, t) in enumerate(zip(classes, times)):
        if c is None or (isinstance(c, float) and np.isnan(c)):
            out[i] = "unknown"
        else:
            out[i] = f"{c}_START" if t <= tf else f"{c}_END"
    return out


def _events_from_user_frame(
    user_df: pd.DataFrame,
    params: dict,
) -> list[dict] | None:
    """Gera sessões de eventos a partir de frame já mapeado (coluna event_class)."""
    if user_df.empty or len(user_df) <= 1:
        return None

    user_df = user_df.sort_values("t")
    classes = user_df["event_class"].values
    times = user_df["t"].astype(np.int64).values

    if params.get("multilevel"):
        classes = _apply_multilevel(classes, times, params["initial_date"], params["final_date"])

    # remove primeira linha (equivalente ao pop(0) do script original)
    classes = classes[1:]
    times = times[1:]

    flag = False
    events: list[dict] = []
    for i in range(len(classes) - 1, -1, -1):
        c = classes[i]
        if c is None or c == "unknown" or (isinstance(c, float) and np.isnan(c)):
            continue
        c = str(c)
        if re.match(r"^assignment_sub(_START|_END)?$", c) and not flag:
            flag = True
        if flag:
            events.append({"event": c, "time": int(times[i])})
    events.reverse()

    if not events:
        return None

    sessions = temporal_folding(events) if params.get("tf") else [events]
    for session in sessions:
        if params.get("coalescing_repeating"):
            coalescing_repeating(session)
        if params.get("coalescing_hidden"):
            coalescing_hidden(session, params.get("multilevel", False))
        if params.get("spell"):
            spell(session)
    return sessions


def prepare_sequences_fast(activity: pd.DataFrame, params: dict, grade_df: pd.DataFrame | None = None) -> list[dict]:
    if "event_class" not in activity.columns:
        activity = activity.merge(
            store.mapping,
            on=["component", "action", "target"],
            how="left",
        ).rename(columns={"class": "event_class"})

    events_by_user: list[dict] = []
    grade_lookup: dict[int, float] = {}
    max_grade = 2.0
    if grade_df is not None and not grade_df.empty:
        max_grade = float(grade_df["max_grade"].iloc[0])
        grade_lookup = {int(r.userid): float(r.student_grade) for r in grade_df.itertuples()}

    for userid, user_df in activity.groupby("userid", sort=False):
        sessions = _events_from_user_frame(user_df, params)
        if not sessions:
            continue
        entry: dict[str, Any] = {
            "key": str(int(userid)),
            "events": sessions,
            "temporal_folding": params.get("tf", False),
        }
        if grade_df is not None and params.get("assignment_id"):
            entry["grade"] = grade_lookup.get(int(userid), 0.0)
            entry["max_grade"] = max_grade
        events_by_user.append(entry)
    return events_by_user


def get_classified_activity(params: dict) -> pd.DataFrame:
    """Retorna activity+first_access já filtrado por janela/atividade."""
    from app.event_pipeline import classify_events, partitioning

    first_access, activity, _ = partitioning({**params, "data": store.logs_mapped}, None)
    fa = store._first_access
    if "event_class" not in fa.columns:
        fa = fa.merge(store.mapping, on=["component", "action", "target"], how="left").rename(
            columns={"class": "event_class"}
        )
    return classify_events(activity, fa)
