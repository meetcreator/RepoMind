"use client";
import { useEffect, useState } from "react";
import { getDocs, getRepo } from "@/lib/api";
import type { Doc, Repo } from "@/types";
import { RepoNav, RepoTabBar } from "@/components/layout/RepoNav";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function DocsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [repo, setRepo] = useState<Repo | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRepo(id).then(setRepo);
    getDocs(id).then((d) => { setDocs(d); setSelected(d[0] ?? null); }).finally(() => setLoading(false));
  }, [id]);

  async function regenerate() {
    if (!selected) return;
    setRegenerating(true);
    const resp = await fetch(`${BASE}/api/repos/${id}/docs/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: selected.node_id }),
    });
    if (!resp.body) { setRegenerating(false); return; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { setRegenerating(false); return; }
        try { content += JSON.parse(payload).token ?? ""; } catch { /**/ }
      }
      setSelected((prev) => prev ? { ...prev, content } : prev);
    }
    setRegenerating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <RepoNav />
      {repo && <RepoTabBar id={id} />}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: "260px", borderRight: "1px solid var(--border)", overflowY: "auto", background: "var(--surface)" }}>
          {loading ? (
            <p style={{ padding: "1rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>Loading...</p>
          ) : docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelected(doc)}
              style={{
                padding: "0.5rem 0.75rem",
                cursor: "pointer",
                borderLeft: selected?.id === doc.id ? "2px solid var(--accent)" : "2px solid transparent",
                fontSize: "0.8125rem",
                color: selected?.id === doc.id ? "var(--text)" : "var(--text-muted)",
              }}
            >
              <p style={{ fontWeight: selected?.id === doc.id ? 500 : 400, marginBottom: "0.125rem" }}>{doc.name}</p>
              <p className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.file_path}
              </p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
          {selected ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <h1 style={{ fontSize: "1rem", flex: 1 }}>{selected.name}</h1>
                <span className="badge badge-pending">{selected.node_type}</span>
                <button className="btn btn-secondary" onClick={regenerate} disabled={regenerating} style={{ fontSize: "0.8125rem" }}>
                  {regenerating ? "Regenerating..." : "Regenerate"}
                </button>
              </div>
              <p className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem" }}>{selected.file_path}</p>
              <div className="card" style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", lineHeight: "1.6" }}>
                {selected.content}
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Select a function or class from the sidebar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
