# RepoMind

Ask your GitHub repository natural-language questions — backed by a real dependency graph and vector search, not a generic chatbot.

```
"Why is auth failing?"
"Where should I add Redis caching?"
"What calls the process_payment function?"
```

## How it works

RepoMind builds a **GraphRAG** pipeline over your code:

1. Parses every file with Tree-sitter (real ASTs, not regex)
2. Writes functions, classes, and their relationships to Neo4j
3. Embeds each code chunk with `nomic-embed-text` into ChromaDB
4. On each question: vector search finds *relevant* code, Neo4j expansion finds *connected* code
5. Both feed the LLM (local Ollama or Groq) for structurally-aware answers

Static analysis (Ruff, Bandit, ESLint, Semgrep, Lizard) runs on the actual code — not LLM guesses.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (runs all backend services)
- [Node.js 20+](https://nodejs.org/) (for the frontend)
- [Python 3.11+](https://www.python.org/) (only needed if running backend outside Docker)
- A GitHub account

---

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/yourname/repomind
cd repomind
cp .env.example .env
```

Edit `.env` and fill in:
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (see step 2)
- `NEXTAUTH_SECRET` — generate with: `openssl rand -base64 32`

### 2. Create a GitHub OAuth App (free, 2 minutes)

1. Go to **https://github.com/settings/applications/new**
2. Fill in:
   - Application name: `RepoMind`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**
4. Copy the **Client ID** → paste into `.env` as `GITHUB_CLIENT_ID`
5. Click **Generate a new client secret** → paste as `GITHUB_CLIENT_SECRET`

### 3. Start the backend stack

```bash
docker compose up -d
```

This boots Neo4j, Redis, ChromaDB, Ollama (+ pulls models automatically), the FastAPI backend, and the RQ worker. First run takes 5–10 minutes for Ollama to pull `qwen2.5-coder:7b` (4 GB).

Verify all services are healthy:

```bash
docker compose ps
curl http://localhost:8080/health   # {"status":"ok"}
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Vercel deployment

The [`frontend/vercel.json`](frontend/vercel.json) deploys the **Next.js
frontend**. When importing this repository, set Vercel's **Root Directory** to
`frontend`; Vercel will then find the Next.js dependency in
`frontend/package.json` and use its standard build settings.

Set these Vercel environment variables:

- `NEXTAUTH_URL` — your deployed Vercel URL (for example,
  `https://repomind.vercel.app`)
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL` — the public URL of the separately deployed FastAPI
  backend

Set the GitHub OAuth App homepage to your Vercel URL and its callback URL to
`https://<your-vercel-domain>/api/auth/callback/github`.

### Optional public demo mode

To demonstrate the frontend without GitHub login or a deployed backend, set
`NEXT_PUBLIC_DEMO_MODE=true` in Vercel for the desired environment and leave
`NEXT_PUBLIC_API_URL` unset. This enables mock data and makes protected pages
public. Do not enable demo mode when the backend exposes real repositories or
user data.

### Public repositories without login

To analyze real public GitHub repositories without user login, deploy the
backend stack separately and configure:

- Vercel: `NEXT_PUBLIC_PUBLIC_REPOSITORIES_MODE=true` and
  `NEXT_PUBLIC_API_URL=https://<your-backend-domain>`
- Backend: `PUBLIC_REPOSITORIES_ONLY=true` and `CORS_ORIGINS` set to the
  Vercel frontend URL

This mode rejects private or inaccessible repositories. It is intended for a
trusted demonstration deployment; add rate limiting before exposing it widely.

Vercel cannot host this project's persistent Docker services (Neo4j, Redis,
ChromaDB, Ollama, or the RQ worker). Deploy the backend and its dependencies
to a container-capable platform, set its `CORS_ORIGINS` variable to the Vercel
URL, and point `NEXT_PUBLIC_API_URL` at that backend.

---

## Verifying each service is healthy

| Service | URL | Expected |
|---|---|---|
| FastAPI backend | http://localhost:8080/health | `{"status":"ok"}` |
| Neo4j browser | http://localhost:7474 | Login page |
| ChromaDB | http://localhost:8001/api/v1/heartbeat | `{"nanosecond heartbeat":...}` |
| Ollama | http://localhost:11434/api/tags | JSON with model list |
| Redis | `docker exec -it repomind-redis-1 redis-cli ping` | `PONG` |

---

## Troubleshooting

### Ollama model pull taking a long time
`qwen2.5-coder:7b` is ~4 GB. The first `docker compose up` blocks until both models are pulled. Check progress:
```bash
docker compose logs -f ollama
```
Models are cached in the `ollama_data` Docker volume — subsequent restarts are instant.

### Neo4j auth mismatch
If you changed `NEO4J_PASSWORD` after the first run, the data volume already has the old password. Fix:
```bash
docker compose down -v   # WARNING: deletes all data
docker compose up -d
```

### Port conflicts
Default ports: `3000` (frontend), `8080` (backend), `7474/7687` (Neo4j), `6379` (Redis), `8001` (Chroma), `11434` (Ollama). If any are in use, edit `docker-compose.yml` to map to different host ports.

---

## Not included in v1

- Multi-user teams, billing, RBAC — single-user auth only
- All programming languages — ships with Python, JavaScript/TypeScript, and Go
- Real-time collaborative chat
- Mobile-responsive polish beyond "doesn't break"

---

## Local commands reference

```bash
# Start everything
docker compose up -d

# View backend logs
docker compose logs -f backend

# View worker (ingestion) logs
docker compose logs -f worker

# Stop everything
docker compose down

# Wipe all data (Neo4j, Chroma, Redis, Ollama models)
docker compose down -v

# Frontend dev server
cd frontend && npm run dev
```
