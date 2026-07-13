"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { getOverview, getRepoStatus, getRepo } from "@/lib/api";
import type { Overview, Repo, RepoStatus } from "@/types";
import { RepoNav, RepoTabBar } from "@/components/layout/RepoNav";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "var(--font-inter)" });

export default function RepoOverviewPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [repo, setRepo] = useState<Repo | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  const pollStatus = useCallback(async () => {
    const s = await getRepoStatus(id);
    setStatus(s);
    if (s.status === "ready") {
      const ov = await getOverview(id);
      setOverview(ov);
    } else if (s.status === "analyzing" || s.status === "pending") {
      setTimeout(pollStatus, 3000);
    }
  }, [id]);

  useEffect(() => {
    getRepo(id).then(setRepo);
    pollStatus();
  }, [id, pollStatus]);

  useEffect(() => {
    if (overview?.mermaid_diagram && diagramRef.current) {
      diagramRef.current.innerHTML = overview.mermaid_diagram;
      mermaid.run({ nodes: [diagramRef.current] });
    }
  }, [overview]);

  return (
    <div>
      <RepoNav />
      {repo && <RepoTabBar id={id} />}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "1.5rem" }}>
        {repo && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h1 style={{ fontSize: "1.125rem", marginBottom: "0.25rem" }}>
              {repo.owner}/{repo.name}
            </h1>
            <p className="mono" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{repo.github_url}</p>
          </div>
        )}

        {status && status.status !== "ready" && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {status.status === "failed" ? (
              <span style={{ color: "var(--error)" }}>Analysis failed: {status.error}</span>
            ) : (
              <>
                <Spinner />
                <span style={{ fontSize: "0.875rem" }}>{status.progress_msg || "Initializing..."}</span>
              </>
            )}
          </div>
        )}

        {overview && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem" }}>
              {[
                { label: "Files", value: overview.stats.total_files },
                { label: "Functions", value: overview.stats.total_functions },
                { label: "Classes", value: overview.stats.total_classes },
                { label: "Issues", value: overview.stats.total_issues },
                { label: "Health", value: `${overview.stats.health_score}/100` },
              ].map((s) => (
                <div key={s.label} className="card" style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, color: s.label === "Health" ? healthColor(overview.stats.health_score) : "var(--text)" }}>
                    {s.value}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="card">
              <h2 style={{ marginBottom: "0.75rem" }}>Architecture summary</h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
                {overview.architecture_summary}
              </p>
            </div>

            {/* Mermaid diagram */}
            <div className="card mermaid-wrapper">
              <h2 style={{ marginBottom: "0.75rem" }}>Import graph</h2>
              <div ref={diagramRef} className="mermaid" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function healthColor(score: number) {
  if (score >= 80) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--error)";
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="var(--border-dark)" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
