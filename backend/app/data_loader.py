"""Carrega e mantém em memória os CSVs do curso."""
from __future__ import annotations

import pandas as pd

from app.config import DATA_FILES, QUIZ_SECTION_MAP, settings


class DataStore:
    def __init__(self) -> None:
        self.logs: pd.DataFrame | None = None
        self.mapping: pd.DataFrame | None = None
        self.quiz_list: pd.DataFrame | None = None
        self.quiz_grades: pd.DataFrame | None = None
        self.timeline: pd.DataFrame | None = None
        self.users: pd.DataFrame | None = None
        self.resources: pd.DataFrame | None = None
        self._user_metrics: dict | None = None

    def load(self) -> None:
        base = settings.data_dir
        self.logs = pd.read_csv(base / DATA_FILES["logs"], index_col="id").sort_values("t")
        self.mapping = pd.read_csv(base / DATA_FILES["mapping"])
        self.quiz_list = pd.read_csv(base / DATA_FILES["quiz_list"])
        self.quiz_grades = pd.read_csv(base / DATA_FILES["quiz_grades"])
        self.timeline = pd.read_csv(base / DATA_FILES["timeline"])
        self.users = pd.read_csv(base / DATA_FILES["users"])
        try:
            self.resources = pd.read_csv(base / DATA_FILES["resources"])
        except FileNotFoundError:
            self.resources = pd.DataFrame()

        if "assignment_id" in self.logs.columns:
            self.logs["assignment_id"] = pd.to_numeric(self.logs["assignment_id"], errors="coerce")

        self.logs_mapped = self.logs.merge(
            self.mapping,
            on=["component", "action", "target"],
            how="left",
        ).rename(columns={"class": "event_class"})

        self._first_access = self.logs.sort_values("t").drop_duplicates(subset=["userid"])

    @property
    def course_start(self) -> int:
        return int(self.timeline["course_start"].iloc[0])

    @property
    def course_end(self) -> int:
        return int(self.timeline["course_end"].iloc[0])

    def get_quizzes(self) -> list[dict]:
        rows = []
        for _, q in self.quiz_list.iterrows():
            rows.append(
                {
                    "id": int(q["id"]),
                    "name": q["name"],
                    "t_open": int(q["t_open"]),
                    "t_close": int(q["t_close"]),
                    "max_grade": float(q["max_grade"]),
                    "grade_pass": float(q["grade_pass"]),
                    "section": QUIZ_SECTION_MAP.get(int(q["id"]), ""),
                }
            )
        return rows

    def get_sections(self) -> list[dict]:
        rows = []
        for _, s in self.timeline.iterrows():
            rows.append(
                {
                    "section_id": int(s["section_id"]),
                    "section_name": s["section_name"],
                    "section": int(s["section"]),
                    "section_closes": int(s["section_closes"]),
                }
            )
        return rows

    def get_event_class_counts(self) -> dict[str, int]:
        merged = self.logs.merge(
            self.mapping,
            on=["component", "action", "target"],
            how="left",
        )
        counts = merged["class"].value_counts().to_dict()
        return {k: int(v) for k, v in counts.items() if pd.notna(k)}

    def get_cities(self) -> list[dict]:
        vc = self.users["city"].value_counts().head(50)
        return [{"city": c, "count": int(n)} for c, n in vc.items()]

    def get_students(self) -> list[dict]:
        active = set(self.logs["userid"].astype(int).tolist())
        u = self.users[self.users["userid"].isin(active)].sort_values("name")
        return [
            {"userid": int(r.userid), "name": str(r.name), "city": str(r.city)}
            for r in u.itertuples()
        ]

    def compute_user_metrics(self) -> dict[int, dict]:
        if self._user_metrics is not None:
            return self._user_metrics

        grades = self.quiz_grades.copy()
        activity_ids = [12841, 12842, 12843, 12844]
        g = grades[grades["id"].isin(activity_ids)].copy()
        g["ratio"] = g["student_grade"] / g["max_grade"]

        per_user = g.groupby("userid").agg(
            mean_ratio=("ratio", "mean"),
            first_ratio=("ratio", "first"),
            last_ratio=("ratio", "last"),
            n_grades=("ratio", "count"),
        )
        per_user["delta"] = per_user["last_ratio"] - per_user["first_ratio"]

        metrics: dict[int, dict] = {}
        for uid, row in per_user.iterrows():
            mean_r = float(row["mean_ratio"])
            delta = float(row["delta"])
            if mean_r < settings.low_grade:
                segment = "risk"
            elif mean_r >= settings.high_grade:
                segment = "high"
            else:
                segment = "medium"
            if delta <= -settings.delta_drop:
                trend = "dropping"
            elif delta >= settings.delta_rise:
                trend = "improving"
            else:
                trend = "stable"
            metrics[int(uid)] = {
                "mean_ratio": mean_r,
                "delta": delta,
                "segment": segment,
                "trend": trend,
            }
        self._user_metrics = metrics
        return metrics


store = DataStore()
