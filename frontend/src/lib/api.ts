import type {
  ChatMessage,
  Doc,
  GraphData,
  Issue,
  Overview,
  PRReview,
  Repo,
  RepoStatus,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Simple local state for mocked repos so additions persist
const getMockRepos = (): Repo[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("repomind_mock_repos");
  if (stored) return JSON.parse(stored);
  const defaults: Repo[] = [
    {
      id: "flask-mock-id",
      github_url: "https://github.com/pallets/flask",
      name: "flask",
      owner: "pallets",
      status: "ready",
      progress_msg: "Analysis complete. 42 files, 4 issues.",
      created_at: new Date().toISOString(),
      analyzed_at: new Date().toISOString(),
      error: null,
    },
    {
      id: "express-mock-id",
      github_url: "https://github.com/expressjs/express",
      name: "express",
      owner: "expressjs",
      status: "ready",
      progress_msg: "Analysis complete. 89 files, 2 issues.",
      created_at: new Date().toISOString(),
      analyzed_at: new Date().toISOString(),
      error: null,
    },
  ];
  localStorage.setItem("repomind_mock_repos", JSON.stringify(defaults));
  return defaults;
};

const saveMockRepo = (url: string): Repo => {
  const parts = url.replace("https://github.com/", "").split("/");
  const owner = parts[0] || "unknown";
  const name = parts[1]?.replace(".git", "") || "repo";
  const newRepo: Repo = {
    id: `mock-${Math.random().toString(36).substr(2, 9)}`,
    github_url: url,
    name,
    owner,
    status: "ready",
    progress_msg: "Analysis complete. Mock data generated.",
    created_at: new Date().toISOString(),
    analyzed_at: new Date().toISOString(),
    error: null,
  };
  const current = getMockRepos();
  current.push(newRepo);
  localStorage.setItem("repomind_mock_repos", JSON.stringify(current));
  return newRepo;
};

function getMockData<T>(path: string, init?: RequestInit): T {
  const cleanPath = path.split("?")[0];

  // GET /repos
  if (cleanPath === "/repos" && (!init || init.method === "GET")) {
    return getMockRepos() as unknown as T;
  }
  // POST /repos
  if (cleanPath === "/repos" && init?.method === "POST" && init.body) {
    const { github_url } = JSON.parse(init.body as string);
    return saveMockRepo(github_url) as unknown as T;
  }
  // GET /repos/{id}
  if (cleanPath.startsWith("/repos/") && cleanPath.split("/").length === 3) {
    const id = cleanPath.split("/")[2];
    const repos = getMockRepos();
    const repo = repos.find((r) => r.id === id) || repos[0];
    return repo as unknown as T;
  }
  // GET /repos/{id}/status
  if (cleanPath.startsWith("/repos/") && cleanPath.endsWith("/status")) {
    return {
      status: "ready",
      progress_msg: "Analysis complete. Mock data active.",
      error: null,
    } as unknown as T;
  }
  // GET /repos/{id}/overview
  if (cleanPath.startsWith("/repos/") && cleanPath.endsWith("/overview")) {
    const id = cleanPath.split("/")[2];
    const repos = getMockRepos();
    const repo = repos.find((r) => r.id === id) || repos[0];
    return {
      repo_id: id,
      files_count: 36,
      functions_count: 148,
      classes_count: 14,
      issues_count: 3,
      health_score: 88,
      tech_stack: ["TypeScript", "Next.js", "TailwindCSS"],
      architecture_summary: `Dependency structure and API endpoints of ${repo?.owner}/${repo?.name}. Uses modern routing layers and modular architectures.`,
      mermaid_diagram: `graph TD
  Layout[layout.tsx] --> Home[page.tsx]
  Home --> Connect[connect/page.tsx]
  Home --> RepoView[repo/[id]/page.tsx]
  RepoView --> API[src/lib/api.ts]`,
    } as unknown as T;
  }
  // GET /repos/{id}/graph
  if (cleanPath.startsWith("/repos/") && cleanPath.endsWith("/graph")) {
    return {
      nodes: [
        { id: "n1", type: "file", data: { label: "src/lib/api.ts", type: "file", file_path: "src/lib/api.ts" } },
        { id: "n2", type: "function", data: { label: "streamChat", type: "function", file_path: "src/lib/api.ts", start_line: 58 } },
        { id: "n3", type: "file", data: { label: "src/app/page.tsx", type: "file", file_path: "src/app/page.tsx" } },
        { id: "n4", type: "function", data: { label: "HomePage", type: "function", file_path: "src/app/page.tsx", start_line: 12 } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2", label: "defines" },
        { id: "e2", source: "n3", target: "n4", label: "defines" },
        { id: "e3", source: "n4", target: "n2", label: "calls", animated: true },
      ],
    } as unknown as T;
  }
  // GET /repos/{id}/issues
  if (cleanPath.startsWith("/repos/") && cleanPath.endsWith("/issues")) {
    return [
      {
        id: 1,
        repo_id: "mock-id",
        file_path: "src/lib/api.ts",
        line: 14,
        col: 2,
        category: "style",
        severity: "warning",
        message: "Unused variable 'err' in try-catch block.",
        tool: "eslint",
        rule: "no-unused-vars",
      },
      {
        id: 2,
        repo_id: "mock-id",
        file_path: "src/lib/auth.ts",
        line: 28,
        col: 8,
        category: "security",
        severity: "error",
        message: "Credentials provider bypass enabled in production environment.",
        tool: "semgrep",
        rule: "dev-bypass-check",
      },
    ] as unknown as T;
  }
  // GET /repos/{id}/docs
  if (cleanPath.startsWith("/repos/") && cleanPath.endsWith("/docs")) {
    return [
      {
        id: 1,
        repo_id: "mock-id",
        node_id: "doc-1",
        node_type: "function",
        name: "streamChat",
        file_path: "src/lib/api.ts",
        content: `### streamChat(repoId, message, history, onToken, onDone, onError)

Streams chat answers from the AI using Server-Sent Events (SSE). 

- **repoId**: Unique identifier of the repository.
- **message**: User query message.
- **history**: Current conversation history thread.
- **onToken**: Callback triggered on every received token chunk.`,
        generated_at: new Date().toISOString(),
      },
    ] as unknown as T;
  }
  // GET /repos/{repoId}/prs/{prNumber}
  if (cleanPath.includes("/prs/")) {
    return {
      pr_number: 104,
      title: "Add credentials provider fallback to Auth options",
      body: "Introduces a development credentials login bypass when GitHub Client IDs are not configured in order to facilitate full application local testing.",
      files: [
        {
          filename: "src/lib/auth.ts",
          status: "modified",
          additions: 21,
          deletions: 1,
          patch: `@@ -8,3 +8,21 @@
+    CredentialsProvider({
+      id: "dev-login",
+      name: "Dev Login",
+      credentials: {},
+      async authorize() {
+        return { id: "dev-user", name: "Dev User" };
+      }
+    })`,
        },
      ],
      ai_comments: [
        "Review Summary: This PR safely injects a dev credentials login bypass only during development or when client placeholders are detected. Verified build and layout configuration matches Next.js 14 rules.",
      ],
    } as unknown as T;
  }

  return {} as T;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(msg);
    }
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (
      err instanceof TypeError ||
      (err as Record<string, unknown>)?.name === "TypeError" ||
      String(err).includes("fetch")
    ) {
      console.warn(`Backend connection failed. Falling back to local mock data for: ${path}`);
      return getMockData<T>(path, init);
    }
    throw err;
  }
}

// ── Repos ────────────────────────────────────────────────────────────────────

export const addRepo = (github_url: string) =>
  req<Repo>("/repos", { method: "POST", body: JSON.stringify({ github_url }) });

export const listRepos = () => req<Repo[]>("/repos");

export const getRepo = (id: string) => req<Repo>(`/repos/${id}`);

export const getRepoStatus = (id: string) => req<RepoStatus>(`/repos/${id}/status`);

export const getGraph = (id: string) => req<GraphData>(`/repos/${id}/graph`);

export const getOverview = (id: string) => req<Overview>(`/repos/${id}/overview`);

// ── Issues ───────────────────────────────────────────────────────────────────

export const getIssues = (id: string, params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return req<Issue[]>(`/repos/${id}/issues${qs}`);
};

// ── Docs ─────────────────────────────────────────────────────────────────────

export const getDocs = (id: string) => req<Doc[]>(`/repos/${id}/docs`);

// ── PR Review ────────────────────────────────────────────────────────────────

export const getPRReview = (repoId: string, prNumber: number, github_url: string) =>
  req<PRReview>(`/repos/${repoId}/prs/${prNumber}?github_url=${encodeURIComponent(github_url)}`);

// ── Chat (SSE) ───────────────────────────────────────────────────────────────

export function streamChat(
  repoId: string,
  message: string,
  history: ChatMessage[],
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
): () => void {
  const ctrl = new AbortController();

  fetch(`${BASE}/api/repos/${repoId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal: ctrl.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        onError(res.statusText);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            onDone();
            return;
          }
          try {
            const data = JSON.parse(payload);
            if (data.token) onToken(data.token);
            if (data.error) onError(data.error);
          } catch {
            /* ignore parse errors */
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name === "AbortError") return;
      
      // SSE Fallback
      console.warn("SSE fetch failed, running local mock chat simulation...");
      const simulatedTokens = [
        "In mock mode, here's how the file structure behaves: ",
        "\n\n",
        "The repository uses Next.js 14 and tailwind structure for layout composition. ",
        "Based on the provided graph context, dependencies are managed under `src/lib/api.ts` which routes API endpoints locally when the backend is offline.",
        "\n\n",
        "Let me know if you want to inspect a particular file path or function call graph!"
      ];
      
      let tokenIdx = 0;
      const interval = setInterval(() => {
        if (tokenIdx < simulatedTokens.length) {
          onToken(simulatedTokens[tokenIdx] + " ");
          tokenIdx++;
        } else {
          clearInterval(interval);
          onDone();
        }
      }, 150);
    });

  return () => ctrl.abort();
}
