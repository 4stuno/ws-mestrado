import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi

from app.data_loader import store
from app.schemas import (
    HealthResponse,
    MetaResponse,
    SimplificationOptions,
    StoriesPreviewResponse,
    TimelineRequest,
    TimelineResponse,
)
from app.services import build_timeline, get_meta, warmup_cache

logging.basicConfig(level=logging.INFO)

API_DESCRIPTION = """
API de **análise de trajetórias de aprendizagem** (curso SEE 2060).

## Funcionalidades

- **Timeline** em coordenadas paralelas: eixo X = ordem na sequência, eixo Y = classe de evento.
- **Simplificações** de sequência: multilevel, coalescing, spell, temporal folding.
- **Filtros**: atividade, aluno, cidade, segmento de desempenho, tipos de evento.
- **Narrativas automáticas** (stories): regras R4–R44 com contagem de alunos impactados.

## Dados

CSVs em `/data`: logs filtrados, `event_mapping.csv`, notas, quizzes, alunos.

## Documentação interativa

- **Swagger UI:** [`/docs`](/docs)
- **ReDoc:** [`/redoc`](/redoc)
- **OpenAPI JSON:** [`/openapi.json`](/openapi.json)
"""

OPENAPI_TAGS = [
    {
        "name": "Sistema",
        "description": "Health check e status do cache em memória.",
    },
    {
        "name": "Metadados",
        "description": "Informações do curso, atividades, alunos, cidades e classes de evento.",
    },
    {
        "name": "Timeline",
        "description": "Geração da visualização principal e narrativas associadas.",
    },
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    store.load()
    warmup_cache()
    yield


app = FastAPI(
    title="API de Trajetórias de Aprendizagem",
    description=API_DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=OPENAPI_TAGS,
    contact={
        "name": "SEE / UPE",
    },
    license_info={
        "name": "Uso acadêmico",
    },
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=OPENAPI_TAGS,
    )
    schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }
    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["Sistema"],
    summary="Verificar saúde da API",
    response_description="Status operacional e tamanho do cache.",
)
def health() -> HealthResponse:
    from app.cache import _sequences_cache

    return HealthResponse(
        status="ok",
        users_in_logs=int(store.logs["userid"].nunique()) if store.logs is not None else 0,
        cache_entries=len(_sequences_cache),
    )


@app.get(
    "/api/meta",
    response_model=MetaResponse,
    tags=["Metadados"],
    summary="Metadados do curso e filtros disponíveis",
    response_description="Quizzes, seções, alunos, cidades, classes de evento e segmentos.",
)
def meta() -> MetaResponse:
    return MetaResponse(**get_meta())


@app.post(
    "/api/timeline",
    response_model=TimelineResponse,
    tags=["Timeline"],
    summary="Gerar timeline e narrativas",
    response_description="Trilhas por aluno, KPIs, classes no eixo Y e stories ativas.",
)
def timeline(req: TimelineRequest) -> TimelineResponse:
    data = build_timeline(req)
    return TimelineResponse(**data)


@app.get(
    "/api/stories",
    response_model=StoriesPreviewResponse,
    tags=["Timeline"],
    summary="Preview de narrativas por atividade",
    response_description="Stories e KPIs para uma atividade sem filtros adicionais.",
)
def stories_preview(
    assignment_id: int = Query(
        12841,
        description="ID da atividade (quiz). Padrão: Atividade 1.",
        examples=[12841, 12842, 12843, 12844],
    ),
) -> StoriesPreviewResponse:
    req = TimelineRequest(
        assignment_id=assignment_id,
        simplification=SimplificationOptions(coalescing_hidden=True),
        declutter_mode="first_class",
    )
    data = build_timeline(req)
    return StoriesPreviewResponse(stories=data.get("stories", []), kpis=data.get("kpis", {}))
