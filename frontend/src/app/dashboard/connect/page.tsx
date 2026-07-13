"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRepo } from "@/lib/api";
import { RepoNav } from "@/components/layout/RepoNav";

const EXAMPLES = [
  "https://github.com/pallets/flask",
  "https://github.com/expressjs/express",
  "https://github.com/golang/group",
];

export default function ConnectPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const repo = await addRepo(url.trim());
      router.push(`/repo/${repo.id}`);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <div>
      <RepoNav />
      <div style={{ maxWidth: "560px", margin: "3rem auto", padding: "0 1.5rem" }}>
        <h1 style={{ marginBottom: "0.5rem", fontSize: "1.25rem" }}>Connect a repository</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.75rem" }}>
          Paste the GitHub URL of any public repository, or a private one you have access to.
        </p>

        <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="github-url" style={{ fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>
              GitHub URL
            </label>
            <input
              id="github-url"
              className="input mono"
              type="url"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ fontSize: "0.8125rem", color: "var(--error)" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Connecting..." : "Connect repository"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: "1.5rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Try an example
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {EXAMPLES.map((ex) => (
              <div key={ex} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost mono"
                  style={{ flexGrow: 1, justifyContent: "flex-start", fontSize: "0.8125rem", padding: "0.375rem 0.5rem" }}
                  onClick={() => setUrl(ex)}
                >
                  {ex}
                </button>
                <a
                  href={ex}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ padding: "0.375rem 0.5rem", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
                  title="Open on GitHub"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
