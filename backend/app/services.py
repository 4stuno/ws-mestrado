"""Serviço principal de timeline e KPIs."""
from __future__ import annotations

import logging

import pandas as pd

from app.cache import get_sequences, sequences_cache_key, set_sequences
from app.config import EVENT_CLASS_ORDER, FLOW_SEQUENCE, RARE_CLASSES_DEFAULT_HIDDEN, settings
from app.data_loader import store
from app.event_pipeline import declutter_events
from app.sequence import list_scenarios, prepare_sequences
from app.schemas import DEFAULT_SCENARIO
from app.stories import STORY_CATALOG, adherence_score, evaluate_stories

logger = logging.getLogger(__name__)


def _user_matches_segment(uid: int, segment: str, metrics: dict) -> bool:
    m = metrics.get(uid, {})
    if segment == "risk":
        return m.get("segment") == "risk"
    if segment == "high":
        return m.get("segment") == "high"
    if segment == "improving":
        return m.get("trend") == "improving"
    if segment == "dropping":
        return m.get("trend") == "dropping"
    if segment == "medium":
        return m.get("segment") == "medium"
    return True


def warmup_cache() -> None:
    """Pré-computa timelines das 4 atividades com opções padrão do dashboard."""
    from app.schemas import TimelineRequest

    for aid in (12841, 12842, 12843, 12844):
        req = TimelineRequest(
            assignment_id=aid,
            scenario=DEFAULT_SCENARIO,
            declutter_mode="first_class",
        )
        try:
            build_timeline(req)
            logger.info("Warmup OK assignment_id=%s", aid)
        except Exception as e:
            logger.warning("Warmup falhou assignment_id=%s: %s", aid, e)


def build_timeline(req) -> dict:
    quiz = None
    t_start = req.t_start or store.course_start
    t_end = req.t_end or store.course_end

    if req.assignment_id:
        qrow = store.quiz_list[store.quiz_list["id"] == req.assignment_id]
        if not qrow.empty:
            quiz = {
                "id": int(req.assignment_id),
                "name": qrow["name"].iloc[0],
                "t_open": int(qrow["t_open"].iloc[0]),
                "t_close": int(qrow["t_close"].iloc[0]),
            }
            t_start = quiz["t_open"]
            t_end = quiz["t_close"]

    params = {
        "initial_date": t_start,
        "final_date": t_end,
        "assignment_id": req.assignment_id,
        "scenario": req.scenario,
    }

    grade_df = store.quiz_grades if req.assignment_id else None

    cache_key = sequences_cache_key(params)
    sequences = get_sequences(cache_key)
    if sequences is None:
        logger.info("Gerando sequências (cache miss) key=%s", cache_key)
        sequences = prepare_sequences(
            store.logs,
            store.mapping,
            req.scenario,
            assignment_id=req.assignment_id,
            initial_date=t_start,
            final_date=t_end,
            grades_df=grade_df,
        )
        set_sequences(cache_key, sequences)
    else:
        logger.info("Sequências do cache key=%s n=%s", cache_key, len(sequences))

    if req.user_ids:
        allowed = set(req.user_ids)
        sequences = [s for s in sequences if int(s["key"]) in allowed]
    if req.cities:
        city_users = set(
            store.users[store.users["city"].isin(req.cities)]["userid"].astype(int).tolist()
        )
        sequences = [s for s in sequences if int(s["key"]) in city_users]
    if req.segment:
        metrics = store.compute_user_metrics()
        sequences = [
            s
            for s in sequences
            if _user_matches_segment(int(s["key"]), req.segment, metrics)
        ]

    # activity reduzido só para stories (amostra se muitos usuários)
    activity = store.logs_mapped[
        (store.logs_mapped["t"] >= t_start) & (store.logs_mapped["t"] <= t_end)
    ]
    if req.assignment_id:
        aid = int(req.assignment_id)
        activity = activity.query(
            f"assignment_id == {aid} | (component != 'core' & component != 'mod_page')"
        )
    metrics = store.compute_user_metrics()

    hidden = set(RARE_CLASSES_DEFAULT_HIDDEN) if req.hide_rare_classes else set()
    allowed_classes = set(req.event_classes) if req.event_classes else None

    total_points = 0
    users_out: list[dict] = []

    for us in sequences[: req.max_users]:
        uid = int(us["key"])
        m = metrics.get(uid, {})
        flat = []
        for sess in us["events"]:
            for ev in sess:
                base = ev["event"].split("_SOME")[0].split("_MANY")[0]
                if base in hidden:
                    continue
                if allowed_classes and base not in allowed_classes:
                    continue
                flat.append({**ev, "class": base, "seq_index": len(flat)})

        if req.declutter_mode == "first_class":
            flat = declutter_events(flat, "first_class")
            for i, ev in enumerate(flat):
                ev["seq_index"] = i

        total_points += len(flat)
        highlight = "neutral"
        if m.get("segment") == "risk" or m.get("trend") == "dropping":
            highlight = "risk"
        elif m.get("segment") == "high" or m.get("trend") == "improving":
            highlight = "good"

        users_out.append({
            "userid": uid,
            "events": flat,
            "sessions": len(us["events"]),
            "temporal_folding": us.get("temporal_folding", False),
            "grade_ratio": m.get("mean_ratio"),
            "delta": m.get("delta"),
            "segment": m.get("segment", "medium"),
            "trend": m.get("trend", "stable"),
            "adherence": round(adherence_score(flat), 2),
            "highlight": highlight,
        })

    if req.declutter_mode == "limit_users" and len(sequences) > req.max_users:
        pass  # already limited

    declutter_suggested = (
        total_points > settings.declutter_points
        or (total_points / max(len(users_out), 1) > settings.declutter_events_per_user)
    )

    class_set = set()
    for u in users_out:
        for e in u["events"]:
            class_set.add(e.get("class", e["event"]))

    ordered = [c for c in EVENT_CLASS_ORDER if c in class_set]
    ordered += sorted(class_set - set(ordered))

    risk_n = sum(1 for u in users_out if u["segment"] == "risk")
    mean_grade = sum(u["grade_ratio"] or 0 for u in users_out) / max(len(users_out), 1)

    story_pack = {}
    if quiz:
        story_pack = evaluate_stories(
            sequences,
            activity,
            quiz,
            metrics,
            req.thresholds.model_dump(),
        )

    return {
        "users": users_out,
        "event_classes": ordered,
        "kpis": {
            "users_filtered": len(users_out),
            "users_total_sequences": len(sequences),
            "at_risk": risk_n,
            "mean_grade_ratio": round(mean_grade, 3),
            "total_events_visible": total_points,
            "improving": sum(1 for u in users_out if u["trend"] == "improving"),
            "dropping": sum(1 for u in users_out if u["trend"] == "dropping"),
        },
        "declutter_suggested": declutter_suggested,
        "course_start": store.course_start,
        "course_end": store.course_end,
        "quiz": quiz,
        "flow_sequence": FLOW_SEQUENCE,
        "stories": story_pack.get("stories", []),
        "active_rules": story_pack.get("active_rule_ids", []),
    }


def get_meta() -> dict:
    metrics = store.compute_user_metrics()
    segments = {"risk": 0, "high": 0, "medium": 0}
    trends = {"improving": 0, "dropping": 0, "stable": 0}
    for m in metrics.values():
        segments[m.get("segment", "medium")] = segments.get(m.get("segment", "medium"), 0) + 1
        trends[m.get("trend", "stable")] = trends.get(m.get("trend", "stable"), 0) + 1

    return {
        "course": {
            "id": 2060,
            "name": store.timeline["course_name"].iloc[0],
            "start": store.course_start,
            "end": store.course_end,
        },
        "quizzes": store.get_quizzes(),
        "sections": store.get_sections(),
        "event_classes": store.get_event_class_counts(),
        "event_class_order": EVENT_CLASS_ORDER,
        "cities": store.get_cities(),
        "students": store.get_students(),
        "users_registered": len(store.users),
        "users_with_logs": int(store.logs["userid"].nunique()),
        "segments": segments,
        "trends": trends,
        "thresholds_defaults": {
            "low_grade": settings.low_grade,
            "high_grade": settings.high_grade,
            "delta_drop": settings.delta_drop,
            "delta_rise": settings.delta_rise,
            "late_try_hours": settings.late_try_hours,
            "inactivity_days": settings.inactivity_days,
            "resource_prep_days": settings.resource_prep_days,
        },
        "story_categories": list({s.category for s in STORY_CATALOG}),
        "scenarios": list_scenarios(),
        "default_scenario": DEFAULT_SCENARIO,
    }
