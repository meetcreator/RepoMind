# RepoMind — Implementation Plan

## Overview

Building **RepoMind** — a developer tool to connect GitHub repos and ask natural-language questions backed by a real dependency graph + vector search (GraphRAG pattern). Fully self-hosted, $0 cost.

## Tech Stack Summary

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 + TypeScript + TailwindCSS + shadcn/ui |
| Graph UI | React Flow + Mermaid.js |
| Backend | FastAPI (Python 3.11) |
| Code parsing | Tree-sitter |
| Graph DB | Neo4j Community (Docker) |
| Vector DB | ChromaDB (Docker) |
| Embeddings | Ollama `nomic-embed-text` |
| LLM | Ollama `qwen2.5-coder:7b` |
| Static analysis | Ruff + Bandit + ESLint + Semgrep + Lizard |
| Background jobs | Redis + RQ |
| Auth | NextAuth.js + GitHub OAuth |

---

## Build Milestones

### Milestone 1 — Scaffold
- Next.js 14 app with App Router, TypeScript strict, TailwindCSS, shadcn/ui
- FastAPI app with `/health` endpoint
- `docker-compose.yml` with Neo4j, Redis, ChromaDB, Ollama, backend, worker
- `.env.example` with all required variables
- Verify: `docker compose up` boots, `/health` returns 200

### Milestone 2 — Auth
- NextAuth.js with GitHub OAuth
- Protected routes redirect when logged out
- Session persisted

### Milestone 3 — Ingestion Pipeline
- POST `/api/repos` → enqueue RQ job
- Worker: shallow git clone → Tree-sitter parse (Python, JS/TS, Go) → Neo4j write
- Nodes: File, Module, Class, Function
- Edges: IMPORTS, CALLS, INHERITS, DEFINED_IN, DEPENDS_ON

### Milestone 4 — Embeddings
- Chunk code by function/class boundary
- Embed with Ollama `nomic-embed-text` → store in ChromaDB
- Link chunk IDs to Neo4j node IDs

### Milestone 5 — Static Analysis
- Run Ruff, Bandit, ESLint, Semgrep, Lizard on cloned repo
- Store findings in SQLite
- Render `/repo/[id]/issues`

### Milestone 6 — Graph UI
- GET `/api/repos/{id}/graph` → React Flow format
- `/repo/[id]/graph` — interactive, filterable, click-to-view-code

### Milestone 7 — Chat / GraphRAG
- POST `/api/repos/{id}/chat`
- Embed question → vector search Chroma → expand via Neo4j graph → LLM via Ollama (SSE)
- Cited file/line chips in frontend

### Milestone 8 — Docs + PR Review
- Auto-generated docs per module/function
- PR diff + AI review comments

### Milestone 9 — Polish
- Apply full design system (§4): light mode, #4F46E5 accent, Inter font, border-over-shadow
- Fix console errors, write README

---

## File Structure

```
RepoMind/
├── ai-repo-architect-build-prompt.md   (untouched)
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                  # FastAPI app entrypoint
│   ├── config.py                # settings via pydantic-settings
│   ├── database/
│   │   ├── neo4j.py
│   │   ├── chroma.py
│   │   └── sqlite.py
│   ├── routers/
│   │   ├── repos.py
│   │   ├── chat.py
│   │   ├── issues.py
│   │   ├── docs.py
│   │   └── prs.py
│   ├── services/
│   │   ├── github.py
│   │   ├── parser.py            # Tree-sitter parsing
│   │   ├── embedder.py          # Ollama nomic-embed-text
│   │   ├── graphrag.py          # GraphRAG pipeline
│   │   ├── analyzer.py          # Static analysis
│   │   └── llm.py               # Ollama LLM + Groq fallback
│   ├── workers/
│   │   └── ingestion.py         # RQ job
│   └── models/
│       └── schemas.py           # Pydantic models
│
└── frontend/
    ├── package.json
    ├── tsconfig.json            # strict: true
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── components.json          # shadcn/ui
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx         # / landing
    │   │   ├── login/page.tsx
    │   │   ├── dashboard/
    │   │   │   ├── page.tsx
    │   │   │   └── connect/page.tsx
    │   │   ├── repo/[id]/
    │   │   │   ├── page.tsx     # overview
    │   │   │   ├── graph/page.tsx
    │   │   │   ├── chat/page.tsx
    │   │   │   ├── issues/page.tsx
    │   │   │   ├── docs/page.tsx
    │   │   │   └── pr/[prId]/page.tsx
    │   │   ├── settings/page.tsx
    │   │   └── api/auth/[...nextauth]/route.ts
    │   ├── components/
    │   │   ├── ui/              # shadcn/ui components
    │   │   ├── layout/          # nav, sidebar
    │   │   ├── repo/            # repo-specific components
    │   │   └── chat/            # chat components
    │   ├── lib/
    │   │   ├── api.ts           # typed API client
    │   │   └── auth.ts          # NextAuth config
    │   └── types/
    │       └── index.ts         # shared TypeScript types
    └── public/
```

---

## Design System

- Background: `#FAFAFA`, Text: `#111827`
- Accent: `#4F46E5` (muted indigo) — buttons, active states, links only
- Font: Inter (Google Fonts)
- Borders: `1px solid #E5E7EB` on cards (no heavy shadows)
- Corner radius: 4–6px
- No glassmorphism, no gradients, no emoji in copy
- Dense, scannable layouts for data screens

---

## Verification Plan

After each milestone:
1. Run `docker compose up` and confirm services healthy
2. Hit endpoints manually
3. Check Next.js dev server has no console errors

### Not included in v1
- Multi-user teams/orgs, billing, RBAC
- All languages (ships: Python, JS/TS, Go)
- Real-time collaborative chat
- Mobile-responsive polish
