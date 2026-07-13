# BUILD PROMPT — Paste this entire document into your coding agent (Claude Code, Cursor, etc.)

You are building **RepoMind** — a tool that lets a developer connect a GitHub repository and ask natural-language questions about it ("why is auth failing?", "where should I add Redis?"), backed by a real dependency graph + vector search over the actual code, not a generic chatbot guess.

Read this entire spec before writing any code. Follow it exactly. Do not substitute paid/SaaS services for anything listed below — **every component must run for $0, with no credit card and no subscription**, either fully local or on a free-forever open-source tier that requires no signup beyond an email.

---

## 0. Non-negotiable engineering rules

1. **Bias toward fewer lines.** Before writing a function, ask "can the standard library / an existing installed dependency already do this in fewer lines?" Never hand-roll parsers, HTTP clients, retry logic, or diffing utilities that a well-known library already provides. Do not add abstraction layers (interfaces, factories, base classes) unless there are at least 2 concrete implementations that need them today — not "might need in future."
2. **No dead code, no TODOs, no placeholders.** Every function you write must be complete and runnable. If something is out of scope, do not stub it — omit it entirely and note it in the README under "Not included in v1."
3. **Zero-error build target.** After finishing each milestone (see §8), actually run the app end-to-end (`docker compose up`, hit the endpoints, load the pages) before moving to the next milestone. Fix all errors before proceeding. Do not hand back a project that only "should" work.
4. **Type-safe everywhere.** TypeScript `strict: true` on the frontend. Python type hints + Pydantic models on the backend. No `any`, no untyped dicts crossing API boundaries.
5. **One README, one `.env.example`, one `docker-compose.yml`** that boots the *entire* stack (databases + backend) with a single command. Frontend runs separately with `npm run dev`.

---

## 1. Tech stack (all free, self-hosted, resume-strong)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS + shadcn/ui | Industry-standard, free, huge resume signal |
| Graph/diagram UI | React Flow + Mermaid.js | Interactive dependency graphs + auto architecture diagrams |
| Backend | FastAPI (Python 3.11) | Async, typed, pairs naturally with the AI/parsing pipeline |
| Code parsing | Tree-sitter (via `tree-sitter` + `tree-sitter-languages` pip package) | Real AST parsing across languages, not regex hacks |
| Graph DB | Neo4j Community Edition (self-hosted via Docker) | Free forever, open source, no Aura cloud subscription needed |
| Vector DB | ChromaDB (self-hosted via Docker, or embedded mode) | Free, open source, no Pinecone/Weaviate cloud bill |
| Embeddings | Ollama running `nomic-embed-text` (local, free, no API key) | Zero cost, zero rate limits, runs on CPU |
| LLM inference | Ollama running `qwen2.5-coder:7b` (local, free) — with an **optional** Groq free-tier API fallback for faster responses if the user wants it | No subscription required either way |
| Static analysis (ground-truth, not LLM guesses) | Ruff + Bandit (Python), ESLint (JS/TS), Semgrep (cross-language security), Lizard (complexity) — all free CLI tools | LLMs hallucinate vulnerabilities; real linters don't |
| Background jobs | Redis + RQ (Redis Queue) — both self-hosted via Docker | Simpler than Celery, fewer moving parts, same resume value |
| Metadata/user DB | SQLite via Prisma (frontend) or SQLModel (backend) | Zero setup, zero external dependency, file-based |
| Auth | NextAuth.js with GitHub OAuth provider only | Free, and doubles as the repo-access mechanism (reuse the OAuth token to clone private repos) |
| Repo access | GitHub REST API + shallow `git clone` via `subprocess` | Free, standard |
| Containerization | Docker + docker-compose | Runs Neo4j, Redis, Chroma, Ollama, backend as one stack |
| Deployment (optional, still free) | Vercel free tier (frontend) + Fly.io/Render free tier (backend) — or just run locally | No card required on either free tier |

Do not introduce Pinecone, Weaviate Cloud, Neo4j Aura, OpenAI API, Anthropic API, Clerk, Auth0, or any other paid/metered service. If a free tier of one of these would objectively work better, ask the user first — don't assume.

---

## 2. System architecture (data flow)

```
User pastes GitHub URL
        │
        ▼
[FastAPI] POST /api/repos  →  enqueue ingestion job (RQ)
        │
        ▼
[Ingestion worker]
  1. shallow git clone
  2. walk file tree, filter by extension allowlist
  3. Tree-sitter parse each file → functions, classes, imports, calls
  4. Build nodes/edges (File, Function, Class, Module) → write to Neo4j
  5. Chunk code by function/class boundary
  6. Embed each chunk (Ollama nomic-embed-text) → store in Chroma
     (metadata: file path, line range, Neo4j node id)
  7. Run static analyzers (Ruff/Bandit/ESLint/Semgrep/Lizard) → store
     findings as structured rows (SQLite), NOT LLM-generated
  8. Mark job complete → frontend polls /api/repos/{id}/status
        │
        ▼
User asks a question in chat
        │
        ▼
[FastAPI] POST /api/repos/{id}/chat
  1. embed the question
  2. vector search top-k chunks in Chroma
  3. expand: pull 1-2 hop graph neighbors of matched nodes from Neo4j
     (e.g. "what calls this function", "what does this import")
  4. assemble context (code chunks + graph relationships)
  5. send to Ollama LLM with a repo-aware system prompt
  6. stream tokens back to frontend via SSE
```

This is the **GraphRAG** pattern: vector search finds *relevant* code, the graph traversal finds *connected* code — combined, the LLM answers with real structural awareness instead of guessing.

---

## 3. Pages & routes (Next.js App Router)

| Route | Purpose |
|---|---|
| `/` | Landing page. Plain, confident, no marketing fluff. One headline, one screenshot/demo GIF, one "Sign in with GitHub" button. |
| `/login` | GitHub OAuth sign-in only (no email/password) |
| `/dashboard` | List of connected repos, each with a status badge (Analyzing / Ready / Failed) and last-analyzed time |
| `/dashboard/connect` | Paste a GitHub URL or pick from the user's OAuth-authorized repos |
| `/repo/[id]` | Overview tab: repo stats, health score, auto-generated architecture summary + Mermaid diagram |
| `/repo/[id]/graph` | Full interactive dependency graph (React Flow), filterable by file/module, click a node to see its code |
| `/repo/[id]/chat` | Q&A chat interface, streamed responses, each answer shows cited files/line numbers as clickable chips |
| `/repo/[id]/issues` | Table of static-analysis findings: security, code smells, complexity hotspots — sortable/filterable, sourced from real linters, not LLM output |
| `/repo/[id]/docs` | Auto-generated documentation per module/function, editable and regeneratable |
| `/repo/[id]/pr/[prId]` | PR review: diff view + AI comments grounded in repo context |
| `/settings` | Toggle between local Ollama and optional Groq API key (stored encrypted, never required) |

Backend routes (FastAPI, all under `/api`):

```
POST   /repos                  # add repo, enqueue ingestion
GET    /repos                  # list user's repos
GET    /repos/{id}/status      # ingestion progress
GET    /repos/{id}/graph       # dependency graph JSON for React Flow
GET    /repos/{id}/overview    # stats + Mermaid diagram source
POST   /repos/{id}/chat        # SSE streamed Q&A
GET    /repos/{id}/issues      # static analysis findings
GET    /repos/{id}/docs        # generated docs
POST   /repos/{id}/docs/regenerate
GET    /repos/{id}/prs/{prId}  # PR diff + review comments
```

---

## 4. Design system — MUST NOT look AI-generated

This is critical. Do not produce the default "gradient hero + glassmorphism + purple-to-blue blob + rounded-everything + emoji sparkle" template that every AI-built landing page looks like. Build something that looks like it belongs next to **Linear, Vercel, or GitHub itself.**

Rules:
- **Light mode only**, one clean neutral background (`#FAFAFA` or `#FFFFFF`), near-black text (`#111827`), not pure black.
- **One accent color, used sparingly** — pick a single deliberate color (e.g. a muted indigo `#4F46E5` or a deep green `#16A34A`), used only for primary buttons, active states, and links. Never gradient it.
- **No glassmorphism, no backdrop-blur, no floating glow blobs, no purple/blue AI-cliché gradients.**
- Typography: system font stack or Inter, one weight scale, generous line-height, no more than 2 font sizes per screen region.
- Borders over shadows: use `1px solid #E5E7EB` borders on cards instead of heavy drop shadows. Sharp, minimal, information-dense — like a real dev tool, not a marketing site.
- Corner radius: consistent small radius (4–8px) everywhere, not `rounded-full` on every element.
- No stock emoji in UI copy ("✨ AI-Powered!" is banned). Write plain, confident, technical copy.
- Empty states and loading states must be real and specific ("Parsing 214 files…", not a generic spinner with "Loading...").
- Data-dense screens (graph, issues table) should look like GitHub's file browser or Linear's issue list — dense, scannable, monospace for code/paths.

---

## 5. Neo4j graph schema

Nodes: `File`, `Module`, `Class`, `Function`
Edges: `IMPORTS`, `CALLS`, `INHERITS`, `DEFINED_IN`, `DEPENDS_ON`

Each node stores: `id`, `name`, `filePath`, `startLine`, `endLine`, `language`.
Each `Function`/`Class` node also stores a `chunkId` that maps 1:1 to its vector embedding in Chroma — this is the link that makes GraphRAG work: a vector hit gives you a graph anchor, and the graph gives you structural context the vector search alone can't.

---

## 6. Code style rules for the agent to enforce on itself

- Prefer composition over inheritance; prefer plain functions over classes unless state must be held.
- Prefer FastAPI's built-in dependency injection over manual wiring.
- Prefer Pydantic models over raw dicts at every API boundary.
- Prefer Tailwind utility classes over custom CSS files; only write custom CSS for the Mermaid/React Flow theme overrides.
- One file = one responsibility. If a file exceeds ~250 lines, split it.
- Use `ruff format` (Python) and `prettier` (TS) as the single source of formatting truth — do not hand-format.

---

## 7. Setup / local dev instructions the agent must produce

`docker-compose.yml` must bring up, with one command:
- `neo4j` (community edition, with `NEO4J_AUTH` set from `.env`)
- `redis`
- `chroma` (server mode)
- `ollama` (with an entrypoint script that pulls `qwen2.5-coder:7b` and `nomic-embed-text` on first boot)
- `backend` (FastAPI, depends_on the above)
- `worker` (RQ worker, same image as backend, different entrypoint)

`.env.example` must list every variable needed (Neo4j creds, Chroma host, Ollama host, GitHub OAuth client id/secret, optional `GROQ_API_KEY`) with comments explaining where to get each one for free.

Frontend: `npm install && npm run dev`, connecting to the backend via `NEXT_PUBLIC_API_URL`.

README must include: prerequisites (Docker, Node 20+, Python 3.11+), setup steps in order, how to create a free GitHub OAuth App (with the exact callback URL to register), how to verify each service is healthy, and troubleshooting for the 3 most likely first-run errors (Ollama model pull taking time, Neo4j auth mismatch, port conflicts).

---

## 8. Build milestones (build and verify in this order)

1. **Scaffold**: Next.js app + FastAPI app + docker-compose with empty services. Verify `docker compose up` boots cleanly and `/health` returns 200.
2. **Auth**: GitHub OAuth login working end-to-end, session persisted, protected routes redirect when logged out.
3. **Ingestion pipeline**: clone → Tree-sitter parse → Neo4j write, for one hardcoded small public repo. Verify graph is queryable in Neo4j browser.
4. **Embeddings**: chunk + embed + store in Chroma, linked to Neo4j node ids. Verify a manual vector query returns sensible chunks.
5. **Static analysis integration**: run the linter suite on the cloned repo, store findings, render `/repo/[id]/issues`.
6. **Graph UI**: `/repo/[id]/graph` renders real React Flow graph from `/api/repos/{id}/graph`.
7. **Chat/GraphRAG**: full pipeline (§2) working end-to-end with streaming responses and cited file/line chips.
8. **Docs generation + PR review**: last, since they reuse everything built above.
9. **Polish pass**: apply the full design system (§4) to every page, fix all console errors/warnings, write the README.

Do not start milestone N+1 until milestone N runs without errors.

---

## 9. What NOT to build in v1 (keep scope tight so it actually ships)

- Multi-user teams/orgs, billing, RBAC — single-user auth only.
- Support for every language — ship with Python, JavaScript/TypeScript, and Go via Tree-sitter grammars; note others as "coming soon."
- Real-time collaborative chat — single-user chat is enough.
- Mobile-responsive polish beyond "doesn't break" — this is a desktop dev tool.

---

**When you (the agent) finish, give me:** the exact commands to run it locally, the GitHub OAuth App setup steps, and a short list of anything you deviated from this spec and why.
