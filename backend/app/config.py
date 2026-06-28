import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    data_dir: Path = Path(os.getenv("TL_DATA_DIR", "/data"))
    session_gap: int = 3600
    low_grade: float = 0.50
    high_grade: float = 0.75
    delta_drop: float = 0.20
    delta_rise: float = 0.15
    late_try_hours: int = 24
    inactivity_days: int = 5
    resource_prep_days: int = 7
    max_users_flow: int = 300
    declutter_points: int = 500
    declutter_events_per_user: int = 80

    class Config:
        env_prefix = "TL_"


settings = Settings()

DATA_FILES = {
    "logs": "see_course2060_12-11_to_11-12_logs_filtered.csv",
    "mapping": "event_mapping.csv",
    "quiz_list": "see_course2060_quiz_list.csv",
    "quiz_grades": "see_course2060_quiz_grades.csv",
    "timeline": "see_course2060_timeline.csv",
    "users": "user_list_see.csv",
    "resources": "see_course2060_resource_list.csv",
}

FLOW_SEQUENCE = [
    "course_vis",
    "resource_vis",
    "assignment_vis",
    "assignment_try",
    "assignment_sub",
]

EVENT_CLASS_ORDER = [
    "course_vis",
    "resource_vis",
    "forum_vis",
    "assignment_vis",
    "assignment_try",
    "assignment_sub",
    "forum_participation",
    "message_read",
    "message_sent",
]

QUIZ_SECTION_MAP = {
    12841: "Competência 1",
    12842: "Competência 2",
    12843: "Competência 3",
    12844: "Competência 4",
}

RARE_CLASSES_DEFAULT_HIDDEN = ["message_sent", "message_read"]
