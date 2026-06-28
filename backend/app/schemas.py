from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Opções de simplificação e limiares
# ---------------------------------------------------------------------------


class SimplificationOptions(BaseModel):
    """Opções de simplificação da sequência de eventos (equivalentes às flags CLI)."""

    multilevel: bool = Field(
        False,
        description="Divide eventos em _START / _END conforme metade do prazo da atividade.",
        examples=[False],
    )
    coalescing_repeating: bool = Field(
        False,
        description="Remove repetições consecutivas do mesmo tipo de evento.",
        examples=[False],
    )
    coalescing_hidden: bool = Field(
        False,
        description="Oculta passos intermediários do fluxo (ex.: assignment_vis antes de try/sub).",
        examples=[True],
    )
    spell: bool = Field(
        False,
        description="Agrupa repetições em _SOME (3–5) ou _MANY (>5). Desativa coalescing_repeating.",
        examples=[False],
    )
    temporal_folding: bool = Field(
        False,
        description="Quebra a sequência em sessões quando o intervalo entre eventos > 1h.",
        examples=[False],
    )

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "multilevel": False,
                "coalescing_repeating": False,
                "coalescing_hidden": True,
                "spell": False,
                "temporal_folding": False,
            }
        ]
    })


class ThresholdOptions(BaseModel):
    """Limiares usados pelo motor de narrativas (stories)."""

    low_grade: float = Field(0.50, ge=0, le=1, description="Média normalizada abaixo da qual o aluno é 'em risco'.")
    high_grade: float = Field(0.75, ge=0, le=1, description="Média normalizada de alto desempenho.")
    delta_drop: float = Field(0.20, ge=0, le=1, description="Queda entre 1ª e última atividade para tendência 'dropping'.")
    delta_rise: float = Field(0.15, ge=0, le=1, description="Melhora entre 1ª e última atividade para tendência 'improving'.")
    late_try_hours: int = Field(24, ge=1, description="Horas antes do fechamento para regra de primeira tentativa tardia.")
    inactivity_days: int = Field(5, ge=1, description="Dias sem eventos relevantes antes do prazo (inatividade).")
    resource_prep_days: int = Field(7, ge=1, description="Janela em dias para exigir resource_vis antes da submissão.")


# ---------------------------------------------------------------------------
# Requisição / resposta da timeline
# ---------------------------------------------------------------------------


class TimelineRequest(BaseModel):
    """Parâmetros para gerar a timeline em coordenadas paralelas."""

    assignment_id: int | None = Field(
        None,
        description="ID do quiz/atividade (ex.: 12841–12844). Se omitido, usa janela do curso.",
        examples=[12841],
    )
    t_start: int | None = Field(None, description="Início da janela temporal (Unix timestamp). Sobrescrito pelo quiz.")
    t_end: int | None = Field(None, description="Fim da janela temporal (Unix timestamp). Sobrescrito pelo quiz.")
    user_ids: list[int] | None = Field(
        None,
        description="Filtrar por IDs de alunos. Use um único ID para trilha individual.",
        examples=[[88802]],
    )
    cities: list[str] | None = Field(None, description="Filtrar por cidades (user_list_see.csv).", examples=[["Recife"]])
    event_classes: list[str] | None = Field(
        None,
        description="Tipos de evento mapeados (event_mapping.csv).",
        examples=[["assignment_vis", "assignment_try", "assignment_sub"]],
    )
    segment: Literal["risk", "high", "medium", "improving", "dropping"] | None = Field(
        None,
        description="Segmento de desempenho ou tendência.",
    )
    simplification: SimplificationOptions = Field(default_factory=SimplificationOptions)
    thresholds: ThresholdOptions = Field(default_factory=ThresholdOptions)
    declutter_mode: Literal["none", "first_class", "limit_users"] = Field(
        "none",
        description="Redução de densidade visual: completo, 1ª ocorrência por classe ou limite de usuários.",
    )
    max_users: int = Field(300, ge=1, le=500, description="Máximo de trilhas paralelas retornadas.")
    hide_rare_classes: bool = Field(True, description="Ocultar message_sent e message_read por padrão.")
    compare_mode: Literal["team", "segment", "user"] = Field("team", description="Modo comparativo (reservado).")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "assignment_id": 12841,
                "user_ids": None,
                "cities": None,
                "event_classes": None,
                "segment": None,
                "simplification": {
                    "multilevel": False,
                    "coalescing_repeating": False,
                    "coalescing_hidden": True,
                    "spell": False,
                    "temporal_folding": False,
                },
                "thresholds": {
                    "low_grade": 0.5,
                    "high_grade": 0.75,
                    "delta_drop": 0.2,
                    "delta_rise": 0.15,
                    "late_try_hours": 24,
                    "inactivity_days": 5,
                    "resource_prep_days": 7,
                },
                "declutter_mode": "first_class",
                "max_users": 300,
                "hide_rare_classes": True,
                "compare_mode": "team",
            }
        ]
    })


class TimelineEvent(BaseModel):
    event: str = Field(..., description="Classe do evento após simplificação (pode incluir sufixos).")
    class_: str = Field(..., alias="class", description="Classe base do evento.")
    time: int = Field(..., description="Timestamp Unix do evento.")
    seq_index: int = Field(..., description="Índice na sequência (eixo X da timeline).")

    model_config = ConfigDict(populate_by_name=True)


class TimelineUser(BaseModel):
    userid: int
    events: list[dict[str, Any]]
    sessions: int = Field(..., description="Número de sessões após temporal folding.")
    temporal_folding: bool
    grade_ratio: float | None = Field(None, description="Média normalizada de notas (0–1).")
    delta: float | None = Field(None, description="Variação última − primeira atividade.")
    segment: Literal["risk", "high", "medium"]
    trend: Literal["improving", "dropping", "stable"]
    adherence: float = Field(..., description="Score de aderência ao caminho ideal (0–1).")
    highlight: Literal["risk", "good", "neutral", "attention"]


class TimelineKpis(BaseModel):
    users_filtered: int
    users_total_sequences: int
    at_risk: int
    mean_grade_ratio: float
    total_events_visible: int
    improving: int
    dropping: int


class QuizInfo(BaseModel):
    id: int
    name: str
    t_open: int
    t_close: int


class StoryItem(BaseModel):
    id: str = Field(..., description="Identificador da regra (ex.: R4, R5).")
    category: str
    title: str
    question: str
    highlight: Literal["risk", "good", "attention"]
    affected_count: int
    affected_pct: float
    affected_users: list[int] = Field(default_factory=list)


class TimelineResponse(BaseModel):
    users: list[TimelineUser]
    event_classes: list[str]
    kpis: TimelineKpis
    declutter_suggested: bool
    course_start: int
    course_end: int
    quiz: QuizInfo | None = None
    flow_sequence: list[str]
    stories: list[StoryItem]
    active_rules: list[str]


# ---------------------------------------------------------------------------
# Metadados e health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    users_in_logs: int = Field(..., description="Alunos distintos nos logs carregados.")
    cache_entries: int = Field(..., description="Entradas no cache de sequências pré-processadas.")


class CourseInfo(BaseModel):
    id: int
    name: str
    start: int
    end: int


class QuizMeta(BaseModel):
    id: int
    name: str
    t_open: int
    t_close: int
    max_grade: float
    grade_pass: float
    section: str


class SectionMeta(BaseModel):
    section_id: int
    section_name: str
    section: int
    section_closes: int


class StudentMeta(BaseModel):
    userid: int
    name: str
    city: str


class CityCount(BaseModel):
    city: str
    count: int


class ThresholdDefaults(BaseModel):
    low_grade: float
    high_grade: float
    delta_drop: float
    delta_rise: float
    late_try_hours: int
    inactivity_days: int
    resource_prep_days: int


class MetaResponse(BaseModel):
    course: CourseInfo
    quizzes: list[QuizMeta]
    sections: list[SectionMeta]
    event_classes: dict[str, int]
    event_class_order: list[str]
    cities: list[CityCount]
    students: list[StudentMeta]
    users_registered: int
    users_with_logs: int
    segments: dict[str, int]
    trends: dict[str, int]
    thresholds_defaults: ThresholdDefaults
    story_categories: list[str]


class StoriesPreviewResponse(BaseModel):
    stories: list[StoryItem]
    kpis: TimelineKpis
