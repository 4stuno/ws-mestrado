# Timeline Learning Analytics (SEE 2060)

Ferramenta de visualização de dados educacionais com foco em **timeline de coordenadas paralelas** (eixo X = sequência de eventos, eixo Y = classe mapeada), simplificações de sequência, storytelling automático e filtros para docentes.

📄 **Documentação técnica completa:** [docs/DOCUMENTACAO_TECNICA.md](docs/DOCUMENTACAO_TECNICA.md)

## Stack

| Camada   | Tecnologia                          |
|----------|-------------------------------------|
| Backend  | Python 3.12, FastAPI, pandas        |
| Frontend | Next.js 15, Mantine UI, D3.js       |
| Dados    | CSVs em `./data` (montados no Docker) |

## Executar com Docker

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000 (use esta URL — o browser chama a API em `localhost:8000` diretamente)  
- **API:** http://localhost:8000  
- **Swagger UI:** http://localhost:8000/docs  
- **ReDoc:** http://localhost:8000/redoc  
- **OpenAPI JSON:** http://localhost:8000/openapi.json  
- **Health:** http://localhost:8000/api/health  

Na primeira subida o backend **pré-aquece o cache** das 4 atividades (~5–30s). O healthcheck aguarda até 3 min. Após isso, `/api/timeline` responde em **&lt;1s** (cache).

Se aparecer `socket hang up` no frontend, reconstrua as imagens (`docker compose up --build`) — versões antigas usavam proxy Next com timeout curto.

## Desenvolvimento local

### Backend

```bash
cd backend
pip install -r requirements.txt
set TL_DATA_DIR=..\data   # Windows
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
set API_INTERNAL_URL=http://localhost:8000
npm run dev
```

Acesse http://localhost:3000 (o `next.config.ts` faz proxy de `/api/*` para o backend).

## API principal

Documentação interativa em **http://localhost:8000/docs** (Swagger).

| Método | Rota            | Descrição                                      |
|--------|-----------------|------------------------------------------------|
| GET    | `/api/health`   | Status e cache                                 |
| GET    | `/api/meta`     | Metadados: quizzes, seções, classes, cidades, alunos |
| POST   | `/api/timeline` | Sequências processadas + KPIs + stories      |
| GET    | `/api/stories`  | Preview de narrativas por atividade            |

### Simplificações (body `simplification`)

- `multilevel` — sufixos `_START` / `_END` na metade do prazo  
- `coalescing_repeating` — remove repetições adjacentes  
- `coalescing_hidden` — oculta passos intermediários (vis→try→sub)  
- `spell` — agrega spells `_SOME` / `_MANY`  
- `temporal_folding` — quebra em sessões (gap 1h)

### Stories

Regras **R4–R44** (subset implementado) avaliam inatividade pré-deadline, submissão sem preparação, correria, gargalos vis→try, perfis de risco, etc. Cada story ativa retorna título, pergunta, contagem de alunos afetados e cor semântica (`risk` / `good` / `attention`).

## Estrutura do monólito

```
ws-mestrado/
├── data/                 # CSVs (não versionar se grandes)
├── backend/app/
│   ├── event_pipeline.py # Pré-processamento de sequências
│   ├── stories.py        # Motor de narrativas
│   ├── services.py       # Timeline + KPIs
│   └── main.py           # FastAPI
├── frontend/src/
│   ├── components/       # D3 timeline, filtros, stories
│   └── app/page.tsx      # Dashboard
└── docker-compose.yml
```

## Dados esperados

- `see_course2060_12-11_to_11-12_logs_filtered.csv`  
- `event_mapping.csv`  
- `see_course2060_quiz_list.csv`  
- `see_course2060_quiz_grades.csv`  
- `see_course2060_timeline.csv`  
- `user_list_see.csv`  

## Próximos passos sugeridos

- Modo comparativo turma vs segmento (cinza no fundo)  
- Zoom temporal real no eixo X (hoje: índice de sequência)  
- Persistência em SQLite para datasets maiores  
- Enriquecimento de tooltips com `resource_list`  
