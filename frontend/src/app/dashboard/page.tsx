"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listRepos } from "@/lib/api";
import type { Repo } from "@/types";
import { RepoNav } from "@/components/layout/RepoNav";

export default function DashboardPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRepos().then(setRepos).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <RepoNav />
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.25rem" }}>Repositories</h1>
          <Link href="/dashboard/connect" className="btn btn-primary">Connect repository</Link>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading repositories...</p>
        ) : repos.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>No repositories connected yet.</p>
            <Link href="/dashboard/connect" className="btn btn-primary">Connect your first repository</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: Repo }) {
  const statusClass = {
    ready: "badge-ready",
    analyzing: "badge-analyzing",
    pending: "badge-pending",
    failed: "badge-failed",
  }[repo.status] ?? "badge-pending";

  return (
    <Link href={`/repo/${repo.id}`} style={{ textDecoration: "none" }}>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "background 120ms" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
      >
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.125rem" }}>
            {repo.owner}/{repo.name}
          </p>
          <p className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {repo.progress_msg || repo.github_url}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {repo.analyzed_at ? new Date(repo.analyzed_at).toLocaleDateString() : "—"}
          </span>
          <span className={`badge ${statusClass}`}>{repo.status}</span>
        </div>
      </div>
    </Link>
  );
}
