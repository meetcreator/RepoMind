"use client";
import { useEffect, useState } from "react";
import { getIssues, getRepo } from "@/lib/api";
import type { Issue, Repo } from "@/types";
import { RepoNav, RepoTabBar } from "@/components/layout/RepoNav";

const TOOLS = ["ruff", "bandit", "eslint", "semgrep", "lizard"];
const SEVERITIES = ["error", "warning", "info"];

export default function IssuesPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [repo, setRepo] = useState<Repo | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [toolFilter, setToolFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");

  useEffect(() => { getRepo(id).then(setRepo); }, [id]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (toolFilter) params.tool = toolFilter;
    if (sevFilter) params.severity = sevFilter;
    setLoading(true);
    getIssues(id, params).then(setIssues).finally(() => setLoading(false));
  }, [id, toolFilter, sevFilter]);

  return (
    <div>
      <RepoNav />
      {repo && <RepoTabBar id={id} />}
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.125rem", marginRight: "auto" }}>
            Issues {!loading && <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontWeight: 400 }}>({issues.length})</span>}
          </h1>

          <select className="input" style={{ width: "auto", fontSize: "0.8125rem" }} value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
            <option value="">All tools</option>
            {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select className="input" style={{ width: "auto", fontSize: "0.8125rem" }} value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading issues...</p>
        ) : issues.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ color: "var(--text-muted)" }}>No issues found with the current filters.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>File</th>
                  <th>Line</th>
                  <th>Rule</th>
                  <th>Message</th>
                  <th>Tool</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td><span className={`sev-${issue.severity}`}>{issue.severity}</span></td>
                    <td className="mono" style={{ fontSize: "0.75rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {issue.file_path}
                    </td>
                    <td className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {issue.line ?? "—"}
                    </td>
                    <td className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {issue.rule ?? "—"}
                    </td>
                    <td style={{ fontSize: "0.8125rem", maxWidth: "360px" }}>{issue.message}</td>
                    <td><span className="badge badge-pending" style={{ fontSize: "0.7rem" }}>{issue.tool}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
