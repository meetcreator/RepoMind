"use client";
import { useState, useEffect } from "react";
import { RepoNav } from "@/components/layout/RepoNav";

export default function SettingsPage() {
  const [useGroq, setUseGroq] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem("groq_key") ?? "";
    setGroqKey(key);
    setUseGroq(!!key);
  }, []);

  function save() {
    if (useGroq && groqKey) {
      localStorage.setItem("groq_key", groqKey);
    } else {
      localStorage.removeItem("groq_key");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <RepoNav />
      <div style={{ maxWidth: "560px", margin: "2.5rem auto", padding: "0 1.5rem" }}>
        <h1 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>Settings</h1>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>LLM backend</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              By default RepoMind uses your local Ollama (qwen2.5-coder:7b). You can optionally use Groq for faster inference — free tier, no credit card.
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
            <input type="checkbox" checked={useGroq} onChange={(e) => setUseGroq(e.target.checked)} />
            Use Groq API (faster, still free)
          </label>

          {useGroq && (
            <div>
              <label htmlFor="groq-key" style={{ fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>
                Groq API key
              </label>
              <input
                id="groq-key"
                className="input mono"
                type="password"
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                Get a free key at console.groq.com — no credit card required.
              </p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={save}>
              {saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Local services</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {[
              { name: "FastAPI backend", url: "http://localhost:8080/health" },
              { name: "Neo4j browser", url: "http://localhost:7474" },
              { name: "ChromaDB", url: "http://localhost:8001/api/v1/heartbeat" },
              { name: "Ollama", url: "http://localhost:11434/api/tags" },
            ].map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener"
                style={{ fontSize: "0.8125rem", color: "var(--accent)", textDecoration: "none", display: "flex", justifyContent: "space-between" }}
              >
                <span>{s.name}</span>
                <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.url}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
