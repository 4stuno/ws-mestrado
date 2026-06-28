"""Pipeline de sequência de eventos (port do script de pré-processamento)."""
import re
from typing import Any

import pandas as pd

from app.config import settings


def event_mapping(event: list, t: int, params: dict) -> dict:
    mapping = params["mapping"]
    mapped = mapping[
        (mapping.component == event[0])
        & (mapping.action == event[1])
        & (mapping.target == event[2])
    ]
    if mapped.empty:
        return {"event": "unknown", "time": t, "raw": event}
    e = mapped["class"].iloc[0]
    result: dict[str, Any] = {"event": e, "time": t}
    if params.get("multilevel"):
        tf = params["initial_date"] + (params["final_date"] - params["initial_date"]) / 2
        e = e + "_START" if t <= tf else e + "_END"
        result = {"event": e, "time": t}
    return result


def temporal_folding(events: list, session_gap: int | None = None) -> list:
    gap = session_gap or settings.session_gap
    if not events:
        return []
    sessions = [[events[0]]]
    for i in range(1, len(events)):
        if events[i]["time"] - events[i - 1]["time"] <= gap:
            sessions[-1].append(events[i])
        else:
            sessions.append([events[i]])
    return sessions


def coalescing_hidden(events: list, multilevel: bool = False) -> None:
    remove_indexes: list[int] = []
    suffix = "_START" if multilevel else ""
    end_suffix = "_END" if multilevel else ""

    for i in range(len(events) - 1):
        try:
            if events[i]["event"] == f"assignment_vis{suffix}" and events[i + 1]["event"] in [
                f"assignment_try{suffix}",
                f"assignment_sub{suffix}",
            ]:
                remove_indexes.append(i)
            elif events[i]["event"] == f"assignment_try{suffix}" and events[i + 1]["event"] == f"assignment_sub{suffix}":
                remove_indexes.append(i)
            elif (
                multilevel
                and events[i]["event"] == f"assignment_vis{end_suffix}"
                and events[i + 1]["event"] in [f"assignment_try{end_suffix}", f"assignment_sub{end_suffix}"]
            ):
                remove_indexes.append(i)
            elif (
                multilevel
                and events[i]["event"] == f"assignment_try{end_suffix}"
                and events[i + 1]["event"] == f"assignment_sub{end_suffix}"
            ):
                remove_indexes.append(i)
        except IndexError:
            pass

    for index in sorted(remove_indexes, reverse=True):
        del events[index]


def coalescing_repeating(events: list) -> None:
    remove_indexes: list[int] = []
    for i in range(len(events)):
        try:
            if events[i]["event"] == events[i + 1]["event"]:
                if re.match(r"^assignment_sub(_START|_END)?$", events[i]["event"]):
                    remove_indexes.append(i)
                else:
                    remove_indexes.append(i + 1)
        except IndexError:
            pass
    for index in sorted(remove_indexes, reverse=True):
        del events[index]


def spell(events: list) -> None:
    remove_indexes: list[int] = []
    for i in range(len(events)):
        try:
            spell_length = 1
            index = i
            while events[index]["event"] == events[index + 1]["event"]:
                spell_length += 1
                index += 1
            if events[i]["event"] == events[i + 1]["event"]:
                if re.match(r"^assignment_sub(_START|_END)?$", events[i]["event"]):
                    remove_indexes.append(i)
                else:
                    remove_indexes.append(i + 1)
            if 2 < spell_length <= 5:
                events[i]["event"] = events[i]["event"] + "_SOME"
            elif spell_length > 5:
                events[i]["event"] = events[i]["event"] + "_MANY"
        except IndexError:
            pass
    for index in sorted(remove_indexes, reverse=True):
        del events[index]


def generate_sequence_from_df(df: pd.DataFrame, params: dict) -> list | None:
    if df.empty:
        return None
    e = list(
        df.apply(
            lambda x: event_mapping([x.component, x.action, x.target], int(x.t), params),
            axis=1,
        )
    )
    if len(e) <= 1:
        return None
    e.pop(0)
    flag = False
    events: list[dict] = []
    for event in reversed(e):
        if event.get("event") == "unknown":
            continue
        if re.match(r"^assignment_sub(_START|_END)?$", event["event"]) and not flag:
            flag = True
        if flag:
            events.append(event)
    events = list(reversed(events))

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


def partitioning(params: dict, grade_df: pd.DataFrame | None = None) -> tuple:
    all_logs_data = params["data"]
    init_date = params["initial_date"]
    final_date = params["final_date"]
    assignment_id = params.get("assignment_id")

    activity_logs = (
        all_logs_data.sort_values("t")
        .query(f"t >= {init_date} & t <= {final_date}")
    )
    if assignment_id:
        aid = int(assignment_id)
        if "assignment_id" in activity_logs.columns:
            activity_logs["assignment_id"] = pd.to_numeric(activity_logs["assignment_id"], errors="coerce")
            activity_logs = activity_logs.query(
                f"assignment_id == {aid} | (component != 'core' & component != 'mod_page')"
            )

    first_access = all_logs_data.sort_values("t").drop_duplicates(subset=["userid"])
    first_access = first_access.sort_values("userid")

    grades = None
    if grade_df is not None and assignment_id:
        grades = grade_df.query(f"id == {assignment_id}")

    return first_access, activity_logs, grades


def classify_events(activity: pd.DataFrame, first_access: pd.DataFrame) -> pd.DataFrame:
    return pd.concat([first_access, activity])


def prepare_user_sequences(activity: pd.DataFrame, params: dict, grade_df: pd.DataFrame | None = None) -> list:
    events_by_user: list[dict] = []
    unique_users = activity.drop_duplicates(subset=["userid"])["userid"].tolist()

    for userid in unique_users:
        user_df = activity[activity.userid == userid].sort_values("t")
        events = generate_sequence_from_df(user_df, params)
        if not events:
            continue
        new_user: dict[str, Any] = {
            "key": str(userid),
            "events": events,
            "temporal_folding": params.get("tf", False),
        }
        if grade_df is not None and params.get("assignment_id"):
            user_grade = grade_df.query(f"userid == {userid}")["student_grade"]
            if user_grade.empty:
                new_user["grade"] = 0.0
            else:
                new_user["grade"] = float(user_grade.iloc[0])
            mg = grade_df["max_grade"]
            new_user["max_grade"] = float(mg.iloc[0]) if not mg.empty else 2.0
        events_by_user.append(new_user)
    return events_by_user


def first_occurrence_per_class(events: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for ev in events:
        base = ev["event"].split("_SOME")[0].split("_MANY")[0]
        if base not in seen:
            seen.add(base)
            out.append(ev)
    return out


def declutter_events(events: list[dict], mode: str = "first_class") -> list[dict]:
    if mode == "first_class":
        return first_occurrence_per_class(events)
    return events
