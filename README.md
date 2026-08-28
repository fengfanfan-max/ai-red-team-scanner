# ai-red-team-scanner

> Open-source AI red-team safety scanning platform — evaluate your own LLM endpoints across multiple risk dimensions (content safety, privacy, compliance, hallucination) and get a safety score, risk distribution, and failure cases.

[![CI](https://github.com/fengfanfan-max/ai-red-team-scanner/actions/workflows/ci.yml/badge.svg)](https://github.com/fengfanfan-max/ai-red-team-scanner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[中文文档](README.zh-CN.md)

## Features

- **AI application management** — register any OpenAI-compatible endpoint (OpenAI / Anthropic / Gemini / local Ollama…). API keys are Fernet-encrypted at rest and only ever returned masked; test-chat validates the connection before scanning.
- **Safety scanning** — 5-step wizard (application / algorithm / dataset / test-chat / advanced settings). Ships with 5 built-in risk datasets (75 prompts) + custom JSON import.
- **Judge evaluation** — an independent judge model scores each response 0–10 with a structured reason, decoupled from the target (use a cheap or local model to control cost). Shows the expected LLM call count before you start.
- **Reusable judge models** — manage judge presets (with encrypted keys) and pick one per scan; provider options like `enable_thinking: false` cut reasoning-model judge latency dramatically.
- **Live progress** — 2s polling, percentage + estimated remaining time, and checkpoint resume (interrupted scans recover on restart).
- **Result insight** — safety score, per-category risk bars, a filterable failure table with a detail drawer (prompt / answer / score / reason), plus per-call latency breakdown (target vs judge).
- **Re-run scans** — replay the same configuration as a new, independent scan for reproducibility checks.
- **Dashboard** — stat cards (scan count / avg score / high-risk), recent scans, risk-by-category distribution.
- **Flexible deployment** — zero-dependency SQLite for local dev, PostgreSQL for production; `AUTH_MODE=disabled` no-login mode; `SIMULATE_SCAN=true` simulated engine for demo/tests without any API key.
- **Operability** — request-logging middleware, configurable log level and rotating log file (`LOG_LEVEL` / `LOG_FILE`).

## Quick start (10 minutes)

**One command (recommended)**:

```bash
./dev.sh        # demo mode: simulated engine + no-login, zero config / zero key
./dev.sh real   # full mode: real LLM + auth
```

The script installs deps, applies migrations, and runs both servers (backend :8000, frontend :5173) in parallel; Ctrl+C stops everything. Override with `BACKEND_PORT` / `FRONTEND_PORT` / `SIMULATE_SCAN` / `AUTH_MODE`.

Manual step-by-step (optional):

```bash
# Prereqs: Python ≥ 3.11 (uv), Node ≥ 22

# 1. Backend (simulated engine + no-login — no API key needed)
cd backend
uv sync
uv run alembic upgrade head
SIMULATE_SCAN=true AUTH_MODE=disabled uv run uvicorn app.main:app --reload

# 2. Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 → create an AI application (any key — simulated mode makes no calls) → Scans → New scan → walk through the wizard → watch progress hit 100% → open the result page for the score and failure cases.

> Real scans: drop `SIMULATE_SCAN=true`, enter a real OpenAI-compatible endpoint and key in the application; set a cheap judge (e.g. a local Ollama model) in step 5 of the wizard.

### Docker Compose (production)

```bash
docker compose up --build                                   # SQLite (single service)
docker compose --profile postgres up --build               # PostgreSQL
```

> Production must set `JWT_SECRET` (≥32 bytes) and `ENCRYPTION_KEY` (Fernet key).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data.db` | SQLAlchemy connection string (Postgres: see ADR-0002) |
| `AUTH_MODE` | `enabled` | `disabled` = no-login mode (local/demo) |
| `JWT_SECRET` | (required in prod) | Signing secret |
| `ENCRYPTION_KEY` | (required in prod) | Fernet key for API-key encryption |
| `SIMULATE_SCAN` | `false` | `true` = simulated engine (demo/test, no LLM calls) |
| `LOG_LEVEL` | `INFO` | Backend log level (`DEBUG` for deep debugging) |
| `LOG_FILE` | *(empty)* | Optional rotating log file (5 MB × 3) |

## Testing

```bash
# Backend (62 tests): lint + unit + migrations
cd backend && uv run ruff check . && uv run pytest -q

# Frontend (24 tests): type-check + lint + unit + build
cd frontend && npm run type-check && npm run lint && npm test && npm run build

# E2E (start both servers first; use system Chrome locally)
cd frontend && PLAYWRIGHT_SYSTEM_CHROME=1 npx playwright test
```

CI (GitHub Actions) runs: backend lint/unit, Postgres-dialect tests, frontend checks, and E2E (downloads Chromium).

## Project structure

```
├── backend/          # FastAPI app (REST API + scanning engine + static frontend)
│   ├── app/
│   │   ├── api/      # routes (auth/applications/datasets/judges/scans/dashboard)
│   │   ├── core/     # config, DB, crypto, security, logging, middleware
│   │   ├── data/     # built-in dataset loader
│   │   └── engine/   # scanning engine (rate limit/judge/dual impl/task mgmt)
│   ├── alembic/      # database migrations
│   └── tests/
├── frontend/         # React 19 + Vite 7 SPA (Tailwind 4 + shadcn/ui/Radix, see ADR-0005)
│   ├── src/
│   └── e2e/          # Playwright scenarios
├── docs/
│   ├── CONTEXT.md    # domain glossary
│   ├── PLAN.md       # development plan & milestones
│   ├── DATASETS.md   # dataset format & contribution guide
│   └── adr/          # architecture decision records
└── .github/workflows # CI + Release
```

## Documentation

- [Development plan & milestones](docs/PLAN.md)
- [Architecture decision records (ADR)](docs/adr/)
- [Domain glossary](docs/CONTEXT.md)
- [Dataset contribution guide](docs/DATASETS.md)
- [Contributing](CONTRIBUTING.md)
- [中文文档](README.zh-CN.md)

## Roadmap

- **v1 (done)** — auth → AI applications → scan wizard → results → dashboard (MVP core loop) + custom datasets + simulated/real dual engine
- **v2 candidates** — multi-tenancy + RBAC, multimodal media evaluation, PDF/CSV/ZIP reports, WebSocket live progress, plugin algorithms

## License

[MIT](LICENSE). Built-in dataset content is also distributed under MIT (see [docs/DATASETS.md](docs/DATASETS.md)).
