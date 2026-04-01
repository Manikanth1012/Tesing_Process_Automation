# TAMT — Test Automation Management Tool

A full-stack internal QA platform that manages the complete test automation lifecycle across projects: from onboarding features and validating prerequisites through AI-assisted test case generation, Robot Framework script authoring, test execution, defect triage, gap analysis, and executive reporting.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
5. [Configuration](#configuration)
6. [Project Hierarchy](#project-hierarchy)
7. [Feature Modules](#feature-modules)
8. [AI Agents](#ai-agents)
9. [Robot Framework Integration](#robot-framework-integration)
10. [User & Role Management](#user--role-management)
11. [AI Assistant](#ai-assistant)
12. [**Process Flow & Memory Architecture Documentation**](#process-flow--memory-architecture-documentation)
13. [API Reference](#api-reference)
14. [Database Schema](#database-schema)
15. [Contributing & Release Notes](#contributing--release-notes)

---

## Overview

TAMT provides a single pane of glass for QA teams to:

- Organise work by **Projects → Test Plans → Features → Test Cases**
- Validate prerequisite readiness before scripting begins
- Generate **Robot Framework `.robot` scripts** using AI agents
- Execute test suites against configured environments with **live output streaming**
- Triage defects with AI-powered root cause analysis and severity classification
- Export reports in **XLSX format** for stakeholders
- Get contextual help from a built-in **AI Assistant** (scoped to TAMT and QA topics)

---

## Architecture

```
┌─────────────────────────────────────────┐
│            Browser (React 18)           │
│  Vite · Tailwind CSS · DM Sans/Syne     │
│  framer-motion · react-markdown         │
│  SSE EventSource (live agent streams)   │
└───────────────┬─────────────────────────┘
                │  REST + SSE  /api/v1/…
┌───────────────▼─────────────────────────┐
│           Express (Node.js)             │
│  better-sqlite3 · multer · SheetJS      │
│  python-shell · xml2js · bcryptjs/JWT   │
└──────────┬────────────────┬─────────────┘
           │                │
   ┌───────▼──────┐  ┌──────▼─────────────┐
   │  SQLite DB   │  │  Python subprocess  │
   │  tamt.db     │  │  Robot Framework 7  │
   └──────────────┘  └────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Anthropic API  │
                    │  7 AI Agents    │
                    │  AI Assistant   │
                    └─────────────────┘
```

---

## Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
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

### 2. Configure environment variables

Create `backend/.env`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional (defaults shown)
PORT=3001
NODE_ENV=development
JWT_SECRET=change-me-in-production
UPLOADS_DIR=./uploads
RF_RESULTS_DIR=./rf-results
RF_SCRIPTS_DIR=./scripts
```

> **Auth note:** When `NODE_ENV` is not `production`, JWT auth is bypassed and a default admin user is injected automatically. Set `NODE_ENV=production` for real deployments.

### 3. Install backend + Robot Framework dependencies

```bash
cd backend
npm install          # also runs: pip install -r python/requirements.txt
```

If `postinstall` fails (pip not in PATH), run manually:

```bash
pip install -r python/requirements.txt
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5. Start the application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev        # nodemon auto-restart on port 3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev        # Vite dev server → http://localhost:5173
```

All `/api` requests from the frontend are proxied to `http://localhost:3001` by Vite.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Claude API key for all AI features |
| `PORT` | `3001` | Express server port |
| `NODE_ENV` | `development` | Set to `production` to enable JWT enforcement |
| `JWT_SECRET` | `tamt-dev-secret` | JWT signing secret (change in production) |
| `UPLOADS_DIR` | `./uploads` | File upload storage (contracts, templates) |
| `RF_RESULTS_DIR` | `./rf-results` | Robot Framework output directory |
| `RF_SCRIPTS_DIR` | `./scripts` | Generated `.robot` file directory |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Claude model used by agents and assistant |

---

## Project Hierarchy

TAMT organises all work in a clear hierarchy:

```
Project
  └── Test Plan  (sprint / release)
        └── Feature  (API / Functional / GUI / Performance)
              ├── Prerequisites  (readiness checklist)
              ├── Reference Templates  (base docs for agents)
              └── Test Case
                    └── RF Script  (.robot file)
                          └── Test Run → Execution → Defect
```

### Projects

Each project has a **unique key** (e.g. `PAYGW`) and contains one or more Test Plans. Projects track:
- Plan count, feature count, automation coverage %
- Open defect count
- Team members with project-level roles

Navigate to **Projects** in the sidebar to create and manage projects.

---

## Feature Modules

### Features

Each feature belongs to a Test Plan and has:
- **Type:** `API` | `Functional` | `GUI` | `Performance`
- **API Sub-type** *(API only)*: `Technical` | `Functional` | `Both`
- **Priority:** P1 / P2 / P3
- **Prerequisites** — readiness checklist with completion tracking and AI analysis
- **Reference Templates** — upload Functional TC templates, GUI TC templates, API Specs, Swagger contracts
- **Test Cases** — linked, auto-generated or manually created

### Prerequisites

Readiness checklist items are pre-populated per feature type. The **PREREQ_ANALYST** agent reads uploaded API contracts and evaluates each item, returning a **readiness score (0–100)**. Scripting is blocked until 100% readiness.

| Feature Type | Key Prerequisites |
|---|---|
| API | API Spec document, Swagger/contract, inputs per operation, dependency order, test data |
| Functional | Use cases, user stories/epics, test case steps, test data, environment |
| GUI | Use cases, user stories, config steps, test case steps, test data, environment |
| Performance | Use cases, load profile config, test case steps, test data, capacity environment |

### Test Plans

Groups features together for a release or sprint. Tracks overall coverage and links to a Project.

### Test Cases

Structured test cases with:
- Type, priority, automation status, steps (JSON), expected result
- Linked RF scripts — auto-matched by naming convention

### Test Runs

Executes `.robot` scripts against a selected environment. Streams live RF output via SSE. Parses `output.xml` on completion and updates each execution record.

### Defects

Linked to test case and run. AI Defect Triage agent pre-fills: severity, priority, steps to reproduce, regression scope, and duplicate detection.

### Reports

Three views with XLSX export:
- **Coverage** — automation coverage % by feature type
- **Execution Summary** — run-by-run pass/fail trends (two-sheet XLSX)
- **Defect Analysis** — defect breakdown by severity and feature

---

## AI Agents

All agents are powered by **Claude claude-sonnet-4-6** via Anthropic's API. Each runs an agentic loop: calls tools server-side, streams thinking/tool activity to the UI via SSE, and persists suggestions for human review.

| # | Agent | Trigger | Output |
|---|-------|---------|--------|
| 1 | **PREREQ_ANALYST** | "Analyse Pre-Reqs" button | Readiness score, blockers, action items |
| 2 | **TESTCASE_GENERATOR** | Manual (requires readiness ≥ 70%) | Test cases with steps, RF keyword hints |
| 3 | **SCRIPT_GENERATOR** | Manual (requires 100% readiness) | `.robot` file + dry-run validation result |
| 4 | **EXECUTION_MONITOR** | **Auto** after run completes | Health score, failure categories, trend |
| 5 | **DEFECT_TRIAGE** | "Triage with AI" on failed execution | Defect draft: severity, priority, steps |
| 6 | **GAP_ANALYST** | "Gap Analysis" on Test Plan | Go/Conditional Go/No Go + gap list |
| 7 | **REPORT_NARRATIVE** | "Generate AI Narrative" on Reports | Executive markdown summary |

### Key Agent Rules

- Every suggestion requires explicit **Accept / Reject / Modify** — no agent auto-writes to the DB
- The `EXECUTION_MONITOR` is the only auto-triggered agent
- All agent runs are fully logged: tokens used, duration, input context — visible in **Settings → Agent Logs**
- Context is always fetched live from the DB at trigger time (no stale state)
- Scripts with dry-run errors remain `Draft` until errors are fixed

### Live Agent UI

The `AgentActivityPanel` component connects to `GET /api/v1/agents/run/:id/stream` (SSE) and renders:

| Event type | Display |
|---|---|
| `thinking` | Gray italic block with animated cursor |
| `tool_call` | Collapsible blue card (tool name + input) |
| `tool_result` | Collapsible green card (tool output) |
| `output` | White card with rendered Markdown |
| `done` | Token count + duration footer |

---

## Robot Framework Integration

### Installation

RF and all library dependencies are installed automatically via `npm install` in the backend:

```bash
pip install -r python/requirements.txt
```

Libraries installed:
| Library | Purpose |
|---------|---------|
| `robotframework` | Core RF engine |
| `robotframework-requests` | API / REST testing |
| `robotframework-seleniumlibrary` | GUI / Selenium browser automation |
| `robotframework-browser` | Playwright-based modern browser testing |
| `robotframework-jsonlibrary` | JSON schema validation |
| `robotframework-datadriver` | Data-driven test execution |
| `robotframework-pabot` | Parallel RF execution |

### Script Naming Convention

```
{test_case_id}_{feature_type}_{slug}.robot
```

Example: `42_api_user_login.robot`

> **Important:** The test case title inside the `.robot` file **must exactly match** `TestCase.title` in the database. This is how `parseRFResults()` maps `output.xml` results back to test case records.

### Execution Flow

1. User clicks **Run** on a Test Run
2. `POST /api/v1/rf/run` → `rfService.executeTestRun()`
3. Node spawns `python/run_suite.py` via `python-shell`
4. Live stdout streams to SSE channel `rf-run:{testRunId}`
5. On completion, `rfService.parseRFResults()` parses `output.xml`
6. `TestExecution` records are bulk-upserted; `TestRun.status` updated
7. `EXECUTION_MONITOR` agent auto-fires

### Script Management

From **Feature Detail → Test Case → Scripts tab**:
- View all versions of a script
- Download raw `.robot` file
- Approve / unapprove scripts
- Trigger dry-run validation
- Generate a new version using the AI Script Generator agent

### Directory Structure

```
backend/
├── scripts/
│   ├── api/          → {id}_api_{slug}.robot
│   ├── functional/   → {id}_functional_{slug}.robot
│   ├── gui/          → {id}_gui_{slug}.robot
│   └── performance/  → {id}_performance_{slug}.robot
├── rf-results/
│   └── {runId}/
│       ├── output.xml
│       └── report.html
└── python/
    ├── requirements.txt   ← all RF dependencies
    └── run_suite.py       ← thin wrapper spawned by Node
```

---

## User & Role Management

### System Roles

Set globally per user in **Settings → Users & Roles**:

| Role | Access |
|------|--------|
| `SuperAdmin` | Full platform access, can manage users |
| `Admin` | Can manage environments, global templates, projects |
| `User` | Standard QA access |

### Project Roles

Set per project in **Projects → [Project] → Members tab**:

| Role | Access |
|------|--------|
| `Admin` | Full project access, can manage members |
| `Lead` | Can approve test cases and scripts |
| `Tester` | Can create and run tests |
| `Viewer` | Read-only access |

### Default Login (development)

```
Email:    admin@tamt.local
Password: password
```

*(Password hash in migration 001 is bcrypt of `password`)*

---

## AI Assistant

A floating chat widget (bottom-right corner) provides contextual help **scoped exclusively to**:

- How to use any TAMT feature (navigation, workflows, buttons)
- Robot Framework scripting, keywords, and library usage
- QA methodology: test case design, prerequisites, coverage analysis
- Understanding test results, defect triage strategies
- The 7 AI agents and how to trigger them

The assistant **declines** to answer questions outside this scope and redirects to TAMT-related help. Conversation history is maintained within a session (last 10 turns).

---

## Process Flow & Memory Architecture Documentation

### Interactive Visual Documentation

TAMT includes comprehensive interactive HTML documentation pages that visualize the testing process flow and AI memory architecture. These pages are designed for stakeholders, new team members, and training purposes.

#### 1. Process Flow Visualization (`tamt-process-flow.html`)

An interactive canvas showing the complete testing automation pipeline from test case input to successful execution.

**Features:**
- **7 Interactive Stage Cards**: Click any stage to see detailed input/output information
  - Prerequisites Analysis (PREREQ_ANALYST)
  - Test Case Generation (TESTCASE_GENERATOR)
  - Script Generation (SCRIPT_GENERATOR)
  - Test Execution (Robot Framework)
  - Execution Monitoring (EXECUTION_MONITOR)
  - Defect Triage (DEFECT_TRIAGE)
  - Reporting & Analytics (REPORT_NARRATIVE + GAP_ANALYST)

- **Visual Flow Elements**:
  - Animated particles showing data flow between stages
  - Color-coded stages with glow effects on hover
  - Gate checks and readiness requirements clearly marked
  - Real-time SSE streaming indicators

- **Comprehensive Documentation Sections**:
  - **7 AI Agents Panel**: Detailed input/output for each agent with REACT loop (Perceive → Reason → Act → Reflect)
  - **Project Hierarchy**: Visual tree showing Project → Test Plan → Feature → Test Case → RF Script → Test Run
  - **Data Stores**: SQLite database tables, file system structure, and Claude API integration
  - **Stage-to-Stage Flow Table**: How data passes between each stage with specific table references

**Opening the documentation:**
```bash
# From project root
open tamt-process-flow.html
# or
python -m http.server 8000
# then navigate to http://localhost:8000/tamt-process-flow.html
```

#### 2. Memory Architecture Visualization (`tamt-memory-architecture.html`)

An interactive page explaining the 3-layer memory system that powers the AI agents' contextual awareness.

**Features:**
- **3-Layer Memory System**:
  - **Layer 1 — Turn History**: Frontend React state with last 10 messages for conversational context
  - **Layer 2 — Agent State**: In-memory execution state during agent runs
  - **Layer 3 — Database Persistence**: Permanent SQLite storage with full audit trail

- **Memory Flow Diagrams**:
  - **Read Phase**: How context is gathered at request start
  - **Process Phase**: All 7 agents and their memory access patterns
  - **Write Phase**: How results are persisted to database

- **Key Documentation Sections**:
  - **Write Triggers**: 8 scenarios that create database records (agent execution, test case generation, defect triage, etc.)
  - **Recall Scenarios**: 6 examples of automatic context retrieval
  - **Layer Comparison Table**: Detailed comparison across scope, persistence, cost, and use cases
  - **Human-in-the-Loop Flow**: Shows the Accept/Reject/Modify workflow for agent suggestions

**Opening the documentation:**
```bash
# From project root
open tamt-memory-architecture.html
# or
python -m http.server 8000
# then navigate to http://localhost:8000/tamt-memory-architecture.html
```

#### Usage for Training & Onboarding

These documentation pages are ideal for:
- **New Team Member Onboarding**: Visual walkthrough of the entire system
- **Stakeholder Presentations**: Executive-friendly visualization without technical jargon
- **Architecture Reviews**: Complete system overview with data flow diagrams
- **QA Training**: Understanding how AI agents assist in test automation
- **Documentation Repository**: Self-contained HTML files that can be hosted anywhere

Both pages are fully self-contained with no external dependencies and feature:
- Dark theme with professional color coding
- Interactive hover tooltips
- Smooth animations and transitions
- Responsive design for all screen sizes
- Click-to-expand detail panels

---

## API Reference

All endpoints are prefixed `/api/v1/`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| **Projects** | `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`, `POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` |
| **Users** | `GET/POST /users`, `GET/PUT/DELETE /users/:id` |
| Features | `GET/POST /features`, `GET/PUT/DELETE /features/:id` |
| Prerequisites | `GET/POST /prerequisites`, `PUT/DELETE /prerequisites/:id` |
| API Contracts | `GET/POST /features/:id/contracts` |
| Reference Templates | `GET/POST /ref-templates`, `GET /ref-templates/:id/content`, `GET /ref-templates/:id/download`, `PUT/DELETE /ref-templates/:id` |
| Test Plans | `GET/POST /test-plans` *(supports `?project_id=`)*, `GET/PUT/DELETE /test-plans/:id`, `POST/DELETE /test-plans/:id/features` |
| Test Cases | `GET/POST /test-cases`, `GET/PUT/DELETE /test-cases/:id` |
| Test Runs | `GET/POST /test-runs`, `GET/PUT /test-runs/:id` |
| Executions | `GET /executions`, `GET/PUT /executions/:id` |
| Defects | `GET/POST /defects`, `GET/PUT/DELETE /defects/:id` |
| RF Scripts | `GET /rf/scripts`, `POST /rf/generate`, `POST /rf/run`, `POST /rf/validate`, `GET /rf/scripts/:id` |
| Agents | `POST /agents/run`, `GET /agents/run/:id/stream` (SSE), `GET /agents/history` |
| **AI Assistant** | `POST /assistant/chat` |
| Reports | `GET /reports/coverage`, `GET /reports/execution-summary`, `GET /reports/defect-analysis` |
| XLSX Exports | `GET /reports/export/coverage`, `GET /reports/export/execution-summary`, `GET /reports/export/defects`, `GET /reports/export/test-cases` |
| Environments | `GET/POST /environments`, `PUT/DELETE /environments/:id` |

---

## Database Schema

SQLite file at `backend/tamt.db`. Migrations run automatically on startup via the `_migrations` tracking table — each `.sql` file in `backend/migrations/` runs exactly once.

| Table | Description |
|-------|-------------|
| `users` | Platform user accounts |
| `projects` | Top-level project containers |
| `project_members` | User ↔ project role assignments |
| `environments` | Target environments (SIT/UAT/PROD/DEV) |
| `features` | Product features under test |
| `prerequisites` | Per-feature readiness checklist items |
| `api_contracts` | Uploaded API spec / Swagger files |
| `reference_templates` | Base template documents (feature or global) |
| `test_plans` | Release/sprint test plans (linked to project) |
| `test_cases` | Individual structured test cases |
| `test_runs` | Test execution runs |
| `test_executions` | Per-test-case execution results |
| `defects` | Defect records |
| `robot_scripts` | Generated `.robot` script metadata + versions |
| `agent_runs` | Agent execution history |
| `agent_suggestions` | Structured suggestions from agents |
| `rf_execution_logs` | Streaming RF stdout logs |
| `script_templates` | Reusable RF script templates (seeded) |
| `_migrations` | Internal — tracks applied migrations |

### Adding a Migration

```bash
# Create a new numbered file
touch backend/migrations/024_your_change.sql

# Write idempotent SQL
# e.g.: ALTER TABLE features ADD COLUMN xyz TEXT;

# Restart the backend — it will apply automatically
npm run dev
```

---

## Contributing & Release Notes

1. Branch off `main` using pattern: `claude/<feature-slug>-<id>` or `<initials>/<feature>`
2. Make your changes and write tests where applicable
3. **Append a new release notes entry** (see format below) before opening a PR
4. Open a pull request targeting `main`

---

### v1.4.0 — 2026-04-01

**Interactive Visual Documentation**
- New `tamt-process-flow.html` — interactive canvas visualization of complete testing pipeline
  - 7 clickable stage cards with detailed I/O information
  - Animated data flow particles between stages
  - Comprehensive sections: 7 AI Agents, Project Hierarchy, Data Stores, Stage-to-Stage Flow
  - REACT loop explanation (Perceive → Reason → Act → Reflect)
  - Color-coded stages with professional dark theme
- New `tamt-memory-architecture.html` — 3-layer AI memory system documentation
  - Layer 1: Turn History (browser state)
  - Layer 2: Agent State (in-memory execution)
  - Layer 3: Database Persistence (SQLite)
  - Memory flow diagrams (Read → Process → Write phases)
  - Write triggers and recall scenarios with examples
  - Human-in-the-Loop approval flow visualization
- Both pages are self-contained HTML files with no external dependencies
- Designed for stakeholder presentations, team onboarding, and training
- Added comprehensive documentation section in README with usage instructions

### v1.3.0 — 2026-03-27

**Project Hierarchy**
- New `projects` table with unique key, status, member management (migrations 019–023)
- `project_id` FK added to `test_plans`; all existing plans migrated to a seeded Default Project
- New `project_members` table: per-project roles (`Admin | Lead | Tester | Viewer`)
- `GET /api/v1/projects` — full CRUD with member and stats roll-up
- Frontend: `Projects.jsx` list page (card grid with key badge, stats)
- Frontend: `ProjectDetail.jsx` with Test Plans and Members tabs
- `GET /api/v1/test-plans` now supports `?project_id=` filter; POST accepts `project_id`

**User & Role Management**
- `system_role` column added to users (`SuperAdmin | Admin | User`, migration 022)
- New `GET/POST/PUT/DELETE /api/v1/users` route
- Frontend: **Settings → Users & Roles** tab with full user table, create/edit/deactivate modals

**AI Assistant (Scoped Chat)**
- New `POST /api/v1/assistant/chat` endpoint — calls Claude API with TAMT-scoped system prompt
- Assistant only answers questions about TAMT, RF, and QA methodology; declines out-of-scope topics
- Floating chat widget (`AiAssistant.jsx`) in bottom-right corner of every page, markdown rendering, 10-turn context window

**Dark Theme UI Overhaul**
- New dark colour system: `#070c18` base, `#00d4ff` brand cyan, semantic green/amber/red/purple
- Fonts: `DM Sans` (body), `DM Mono` (mono), `Syne` (headings/display)
- All components updated: `Sidebar`, `Layout`, `Modal`, `StatusBadge`, `index.css`, `tailwind.config.js`
- Subtle 48px grid background, glowing scrollbars, animated pulse-dot in sidebar

**Robot Framework Dependencies**
- Added `robotframework-browser` (Playwright), `robotframework-pabot` (parallel execution) to `requirements.txt`
- Added `postinstall` npm script to auto-run `pip install -r python/requirements.txt`
- Added `npm run setup:rf` convenience script

---

### v1.2.0 — 2026-03-27

**API Sub-types**
- `api_sub_type TEXT` column on `features` table (`Technical | Functional | Both`)
- Sub-type toggle in Create Feature modal (API type only), inline toggle in Feature Detail
- Pill badge in Features list

**Reference & Base Template Management**
- New `reference_templates` table (migration 018)
- REST API at `/api/v1/ref-templates` — file upload (multer) or inline paste
- Feature Detail → **Templates & Specs** tab grouped by: Functional TC, GUI TC, API Spec, Swagger
- **Settings → Global Templates** tab for `is_global` templates shared across all features

**XLSX Export**
- `sendXlsx()` helper with SheetJS, auto-fit column widths
- Export endpoints: coverage, execution summary (2 sheets), defects, test cases
- Download buttons on Reports, Test Cases list, Feature Detail test cases tab

---

### v1.1.0 — Initial Build

**Robot Framework Integration**
- `rfService.js`: script generation, subprocess execution, `output.xml` parsing
- `python/run_suite.py`: thin Python wrapper streaming stdout line-by-line
- Script naming: `{test_case_id}_{feature_type}_{slug}.robot`
- Dry-run validation gate before approval

**7 AI Agents**
- PREREQ_ANALYST, TESTCASE_GENERATOR, SCRIPT_GENERATOR, EXECUTION_MONITOR, DEFECT_TRIAGE, GAP_ANALYST, REPORT_NARRATIVE
- `agentService.js`: Claude API agentic loop with tool dispatch + SSE streaming
- `AgentActivityPanel.jsx`: framer-motion animated live feed

**Application Scaffold**
- 18 DB migrations; 15+ Express route files
- React frontend: 10 pages across full TAMT lifecycle
- `_migrations` table preventing duplicate migration runs
- JWT auth with dev-mode bypass
