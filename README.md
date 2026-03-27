# TAMT — Test Automation Management Tool

A full-stack web application for managing the entire software testing lifecycle: from feature onboarding and prerequisite analysis through AI-assisted test case generation, Robot Framework script automation, execution monitoring, defect triage, and executive reporting.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
5. [Configuration](#configuration)
6. [Project Structure](#project-structure)
7. [Features & Modules](#features--modules)
8. [AI Agents](#ai-agents)
9. [Robot Framework Integration](#robot-framework-integration)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Contributing](#contributing)
13. [Release Notes](#release-notes)

---

## Overview

TAMT provides a single pane of glass for QA and engineering teams to:

- **Define features** (API, Functional, GUI, Performance) with prerequisite checklists and API contracts
- **Generate test cases** automatically using AI agents with full traceability
- **Author Robot Framework scripts** with AI assistance, validation, and template management
- **Execute test suites** against configured environments and stream live output
- **Triage defects** with AI-powered root cause analysis
- **Export reports** in XLSX format for stakeholder communication

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Browser (React)            │
│  Vite + Tailwind + framer-motion        │
│  react-router-dom v6 · recharts         │
│  SSE EventSource for live agent output  │
└───────────────┬─────────────────────────┘
                │ REST + SSE  /api/v1/...
┌───────────────▼─────────────────────────┐
│          Express (Node.js)              │
│  better-sqlite3 · multer · jsonwebtoken │
│  SheetJS (xlsx) · xml2js · python-shell │
└────────┬──────────────┬─────────────────┘
         │              │
┌────────▼──────┐  ┌────▼────────────────┐
│  SQLite DB    │  │  Python subprocess  │
│  tamt.db      │  │  Robot Framework 7  │
└───────────────┘  └─────────────────────┘
                          │
               ┌──────────▼──────────┐
               │  Claude API         │
               │  (claude-sonnet-4)  │
               │  7 AI Agents (SSE)  │
               └─────────────────────┘
```

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Python | ≥ 3.9 |
| pip | ≥ 22.x |
| Anthropic API Key | — |

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd Tesing_Process_Automation/tamt
```

### 2. Install Python dependencies

```bash
pip install -r backend/python/requirements.txt
```

Robot Framework libraries installed:
- `robotframework >= 7.0`
- `robotframework-requests`
- `robotframework-seleniumlibrary`
- `robotframework-jsonlibrary`
- `robotframework-datadriver`

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Configure environment variables

Create `backend/.env`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional (defaults shown)
PORT=3001
NODE_ENV=development
JWT_SECRET=changeme-in-production
UPLOADS_DIR=./uploads
RF_RESULTS_DIR=./rf-results
RF_SCRIPTS_DIR=./scripts
```

> **Auth note:** When `NODE_ENV` is not `production`, all API requests bypass JWT authentication automatically (dev mode). Set `NODE_ENV=production` and issue tokens via `POST /api/v1/auth/login` for production deployments.

### 5. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 6. Start the application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev        # nodemon auto-restart
# or: npm start   # production
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev        # Vite dev server on http://localhost:5173
```

The backend starts on **port 3001** by default. Vite proxies `/api` requests to `http://localhost:3001`.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Claude API key for AI agents |
| `PORT` | `3001` | Express server port |
| `NODE_ENV` | `development` | `production` enables JWT auth |
| `JWT_SECRET` | `changeme` | JWT signing secret |
| `UPLOADS_DIR` | `./uploads` | File upload storage path |
| `RF_RESULTS_DIR` | `./rf-results` | Robot Framework output directory |
| `RF_SCRIPTS_DIR` | `./scripts` | Generated `.robot` file directory |

### Robot Framework Variable Injection

When executing a test run, environment variables from the selected environment record are injected into Robot Framework via `--variable KEY:VALUE` flags. Define your base URL, credentials, and timeouts as environment records in **Settings → Environments**.

---

## Project Structure

```
tamt/
├── backend/
│   ├── migrations/          # SQL migrations (auto-applied on startup)
│   │   ├── 001_create_users.sql
│   │   ├── ...
│   │   └── 018_create_reference_templates.sql
│   ├── python/
│   │   ├── requirements.txt  # RF + Python dependencies
│   │   └── run_suite.py      # Thin RF wrapper spawned by Node
│   ├── scripts/              # Generated .robot files (gitignored)
│   ├── rf-results/           # RF output.xml / log.html (gitignored)
│   ├── uploads/              # Uploaded contracts & templates (gitignored)
│   ├── src/
│   │   ├── agents/           # 7 Claude-powered AI agents
│   │   ├── config/
│   │   │   └── database.js   # Migration runner + DB singleton
│   │   ├── middleware/        # Auth, error handling
│   │   ├── routes/           # Express route handlers
│   │   └── services/
│   │       ├── agentService.js   # Claude API agentic loop
│   │       ├── rfService.js      # RF orchestration
│   │       └── sseService.js     # SSE channel manager
│   └── server.js
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── agents/
│       │   │   └── AgentActivityPanel.jsx  # Live SSE agent feed
│       │   └── common/                     # Modal, StatusBadge, etc.
│       ├── hooks/
│       │   └── useSSE.js       # EventSource wrapper hook
│       ├── pages/              # One file per route/page
│       ├── services/
│       │   └── api.js          # Axios API service modules
│       └── main.jsx
└── README.md                   # ← You are here
```

---

## Features & Modules

### Features

Represents a product feature under test. Each feature has:

- **Type:** `API` | `Functional` | `GUI` | `Performance`
- **API Sub-type** *(API features only)*: `Technical` | `Functional` | `Both`
- **Priority:** `P1` | `P2` | `P3`
- **Status:** `Active` | `In Progress` | `Completed` | `On Hold`
- **Prerequisites** — readiness checklist items with completion tracking
- **API Contracts** — uploaded OpenAPI/Swagger files or pasted specs
- **Reference Templates** — base documents for agent context (see below)
- **Test Cases** — linked test cases with full traceability

### Test Plans

Groups features together for a release or sprint. Tracks overall coverage and includes a release readiness score computed by the Gap Analyst agent.

### Test Cases

Structured test cases with:
- **Type:** API / Functional / GUI / Performance
- **Priority:** P1–P3
- **Automation Status:** Not Started / In Progress / Automated / Manual Only
- **Steps** (JSON) and **Expected Result**
- **Linked Robot Framework scripts** — auto-matched by naming convention

### Test Runs

Executes one or more `.robot` scripts against a target environment. Streams live output via SSE. Parses `output.xml` on completion and records pass/fail per test case.

### Defects

Tracks defects found during test execution. Linked to the originating test case and test run. AI Defect Triage agent populates severity, priority, steps to reproduce, and regression scope.

### Reports

Three report views with XLSX export:
- **Coverage Report** — feature automation coverage %
- **Execution Summary** — run-by-run pass/fail trends
- **Defect Analysis** — defect breakdown by severity/feature

### Reference Templates & Specs

Base documents that AI agents use as context during generation:

| Type | Purpose |
|------|---------|
| `FUNCTIONAL_TC` | Reference functional test case template |
| `GUI_TC` | Reference GUI test case template |
| `API_SPEC` | API specification document |
| `SWAGGER` | Swagger / OpenAPI contract |

Templates can be scoped to a **specific feature** (via Feature Detail → Templates & Specs tab) or set as **global** (via Settings → Global Templates) to apply across all features.

---

## AI Agents

All agents are powered by **Claude claude-sonnet-4** via Anthropic's API. Each agent runs in an autonomous agentic loop: it calls tools server-side, streams intermediate thinking/tool activity to the UI via SSE, and persists its suggestions to the database.

| Agent | Trigger | Purpose |
|-------|---------|---------|
| **PREREQ_ANALYST** | Manual / on feature view | Assesses prerequisite readiness (0–100 score). Flags blockers and risks. |
| **TESTCASE_GENERATOR** | Manual (requires readiness ≥ 70) | Generates structured test cases for a feature with full step detail. |
| **SCRIPT_GENERATOR** | Manual per test case | Generates Robot Framework `.robot` script; runs `--dryrun` validation before saving. |
| **EXECUTION_MONITOR** | Auto after run completes | Analyses pass/fail patterns, categorises failures, flags flaky tests. |
| **DEFECT_TRIAGE** | Manual per failed execution | Creates structured defect with severity, priority, and regression scope. |
| **GAP_ANALYST** | Manual per test plan | Calculates release readiness; outputs Go / Conditional Go / No Go recommendation. |
| **REPORT_NARRATIVE** | Manual per report | Generates executive markdown summary under 600 words. |

### Live Agent UI

The `AgentActivityPanel` component connects to `GET /api/v1/agents/run/:id/stream` (SSE) and renders:
- `thinking` — gray italic block with animated cursor
- `tool_call` — collapsible blue card (tool name + input JSON)
- `tool_result` — collapsible green card (tool output)
- `output` — white card with rendered Markdown (react-markdown)
- `done` — token count + duration footer

---

## Robot Framework Integration

### Script Naming Convention

Generated scripts follow the pattern:

```
{test_case_id}_{feature_type}_{slug}.robot
```

Example: `42_API_login-happy-path.robot`

The test case title inside the `.robot` file **must exactly match** `TestCase.title` in the database — this is how `parseRFResults()` maps XML results back to test case records.

### Execution Flow

1. User clicks **Run** on a Test Run
2. `POST /api/v1/rf/run` → `rfService.executeTestRun()`
3. Node spawns `python/run_suite.py` via `python-shell`
4. Live stdout streams to SSE channel `rf-run:{testRunId}`
5. On completion, `rfService.parseRFResults()` parses `output.xml` via `xml2js`
6. `TestExecutions` records are bulk-upserted; `TestRun.status` set to `Completed` / `Failed`
7. `EXECUTION_MONITOR` agent auto-fires

### Dry-run Validation

`POST /api/v1/rf/validate` runs `robot --dryrun` on a script. Scripts with validation errors remain in `Draft` status and cannot be `Approved`.

---

## API Reference

All endpoints are prefixed `/api/v1/`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| Features | `GET/POST /features`, `GET/PUT/DELETE /features/:id` |
| Prerequisites | `GET/POST /prerequisites`, `PUT/DELETE /prerequisites/:id` |
| API Contracts | `GET/POST /features/:id/contracts`, `DELETE /contracts/:id` |
| Reference Templates | `GET/POST /ref-templates`, `GET /ref-templates/:id/content`, `GET /ref-templates/:id/download`, `PUT/DELETE /ref-templates/:id` |
| Test Plans | `GET/POST /test-plans`, `GET/PUT/DELETE /test-plans/:id` |
| Test Cases | `GET/POST /test-cases`, `GET/PUT/DELETE /test-cases/:id` |
| Test Runs | `GET/POST /test-runs`, `GET/PUT /test-runs/:id` |
| Executions | `GET /executions`, `GET/PUT /executions/:id` |
| Defects | `GET/POST /defects`, `GET/PUT/DELETE /defects/:id` |
| RF Scripts | `GET /rf/scripts`, `POST /rf/generate`, `POST /rf/run`, `POST /rf/validate`, `GET /rf/scripts/:id` |
| Agents | `POST /agents/run`, `GET /agents/run/:id/stream` (SSE), `GET /agents/history` |
| Reports | `GET /reports/coverage`, `GET /reports/execution-summary`, `GET /reports/defect-analysis` |
| **XLSX Exports** | `GET /reports/export/coverage`, `GET /reports/export/execution-summary`, `GET /reports/export/defects`, `GET /reports/export/test-cases` |
| Environments | `GET/POST /environments`, `PUT/DELETE /environments/:id` |

---

## Database Schema

The database is a SQLite file (`backend/tamt.db`) managed by `better-sqlite3`. Migrations run automatically on startup via the `_migrations` tracking table — each `.sql` file in `backend/migrations/` is applied exactly once.

| Table | Description |
|-------|-------------|
| `users` | User accounts (bcrypt passwords) |
| `environments` | Target environments (SIT/UAT/PROD/DEV) |
| `features` | Product features under test |
| `prerequisites` | Feature readiness checklist items |
| `api_contracts` | Uploaded API spec files per feature |
| `reference_templates` | Base template documents (feature-scoped or global) |
| `test_plans` | Release/sprint test plans |
| `test_cases` | Individual test cases |
| `test_runs` | Test execution runs |
| `test_executions` | Per-test-case execution results |
| `defects` | Defect records |
| `robot_scripts` | Generated `.robot` script metadata |
| `agent_runs` | Agent execution history |
| `agent_suggestions` | Structured suggestions from agent runs |
| `rf_execution_logs` | Streaming RF stdout logs |
| `script_templates` | Reusable RF script templates (seeded) |
| `_migrations` | Migration tracking (internal) |

### Adding a Migration

Create a new numbered file in `backend/migrations/`:

```bash
touch backend/migrations/019_your_change.sql
```

Write idempotent SQL (use `IF NOT EXISTS`, `IF NOT EXISTS` column checks, etc.). The migration runner applies it once on the next server start.

---

## Contributing

1. Branch off `main` using the pattern `claude/<feature-slug>-<id>`
2. Make changes and write tests where applicable
3. Update the **Release Notes** section below with a summary of your changes
4. Open a pull request targeting `main`

---

## Release Notes

---

### v1.2.0 — 2026-03-27

**API Sub-types for API Features**
- Added `api_sub_type` column to the `features` table (`Technical` | `Functional` | `Both`)
- Sub-type toggle displayed in the Features list as a pill badge
- Sub-type inline toggle buttons in Feature Detail overview card
- Sub-type selector shown in the Create Feature modal (only when `feature_type = API`)

**Reference & Base Template Management**
- New `reference_templates` database table (migration 018)
- Full REST API at `/api/v1/ref-templates` — list, create (file upload or inline paste), read content, download, update, delete
- Feature Detail gains a **Templates & Specs** tab grouped by template type: Functional TC, GUI TC, API Spec, Swagger/OpenAPI
- **Settings → Global Templates** tab for managing `is_global` templates available to all features and agents
- Agents can now pull reference templates as tool context during generation

**XLSX Export**
- Backend `sendXlsx()` helper using SheetJS with auto-fit column widths
- Export endpoints:
  - `GET /reports/export/test-cases` — filtered test case list
  - `GET /reports/export/execution-summary` — two-sheet workbook (Run Summary + Execution Detail)
  - `GET /reports/export/defects` — full defect list with feature/TC linkage
  - `GET /reports/export/coverage` — feature coverage with automation % per type
- Download buttons added to: Reports page (all tabs), Test Cases list, Feature Detail test cases tab

---

### v1.1.0 — Initial Agentic Build

**Robot Framework Integration**
- `rfService.js` — script generation, execution via `python-shell`, `output.xml` parsing
- `python/run_suite.py` — thin Python wrapper streaming RF stdout line-by-line
- Script naming convention: `{test_case_id}_{feature_type}_{slug}.robot`
- Dry-run validation endpoint before script approval

**AI Agents (7 total)**
- PREREQ_ANALYST, TESTCASE_GENERATOR, SCRIPT_GENERATOR, EXECUTION_MONITOR, DEFECT_TRIAGE, GAP_ANALYST, REPORT_NARRATIVE
- Claude API agentic loop in `agentService.js` — tool call dispatch, SSE streaming, DB persistence
- `AgentActivityPanel` React component with framer-motion animated SSE feed

**Full Application Scaffold**
- 18 database migrations (users → script_templates + seeds)
- 15 Express route files covering all TAMT entities
- React frontend: Dashboard, Features, Feature Detail, Test Plans, Test Cases, Test Runs, Defects, Reports, Settings pages
- `_migrations` tracking table preventing duplicate migration runs
- JWT auth with dev-mode bypass (`NODE_ENV !== production`)
