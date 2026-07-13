"use client";
import { useState, useEffect } from "react";
import { getPRReview, getRepo } from "@/lib/api";
import type { PRReview, Repo } from "@/types";
import { RepoNav, RepoTabBar } from "@/components/layout/RepoNav";

export default function PRPage({ params }: { params: { id: string; prId: string } }) {
  const { id, prId } = params;
  const [repo, setRepo] = useState<Repo | null>(null);
  const [review, setReview] = useState<PRReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { getRepo(id).then(setRepo); }, [id]);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    getPRReview(id, Number(prId), repo.github_url)
      .then(setReview)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  return (
    <div>
      <RepoNav />
      {repo && <RepoTabBar id={id} />}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "1.5rem" }}>
        {loading && <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading PR review...</p>}
        {error && <p style={{ color: "var(--error)", fontSize: "0.875rem" }}>{error}</p>}

        {review && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.125rem", marginBottom: "0.25rem" }}>
                PR #{review.pr_number}: {review.title}
              </h1>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{review.body}</p>
            </div>

            {/* Changed files */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
                <h2>Changed files ({review.files.length})</h2>
              </div>
              <table className="data-table">
                <thead><tr><th>File</th><th>Status</th><th>+</th><th>−</th></tr></thead>
                <tbody>
                  {review.files.map((f, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: "0.8125rem" }}>{f.filename}</td>
                      <td><span className="badge badge-pending">{f.status}</span></td>
                      <td style={{ color: "var(--success)", fontWeight: 600 }}>+{f.additions}</td>
                      <td style={{ color: "var(--error)", fontWeight: 600 }}>−{f.deletions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AI review */}
            {review.ai_comments.length > 0 && (
              <div className="card">
                <h2 style={{ marginBottom: "0.75rem" }}>AI review</h2>
                <div style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", lineHeight: "1.6" }}>
                  {review.ai_comments.join("\n")}
                </div>
              </div>
            )}

            {/* Diffs */}
            {review.files.filter((f) => f.patch).map((f, i) => (
              <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)", background: "#f9fafb" }}>
                  <span className="mono" style={{ fontSize: "0.8125rem" }}>{f.filename}</span>
                </div>
                <pre style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", overflowX: "auto", margin: 0 }}>
                  {f.patch.split("\n").map((line, j) => (
                    <div key={j} className={line.startsWith("+") ? "diff-add" : line.startsWith("-") ? "diff-del" : ""}>
                      {line}
                    </div>
                  ))}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
