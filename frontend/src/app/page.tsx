import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";


export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="nav">
        <span className="nav-logo">RepoMind</span>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/login" className="btn btn-primary">Sign in with GitHub</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 1.5rem" }}>
        <div style={{ maxWidth: "640px", textAlign: "center" }}>
          <p className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            GraphRAG-powered code intelligence
          </p>
          <h1 style={{ marginBottom: "1.25rem" }}>
            Ask your codebase anything.<br />Get grounded answers.
          </h1>
          <p style={{ fontSize: "1.0625rem", color: "var(--text-muted)", lineHeight: "1.7", marginBottom: "2rem" }}>
            RepoMind parses your GitHub repository into a real dependency graph, embeds
            every function and class, then answers your questions with structural
            awareness — not generic LLM guesses.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ fontSize: "0.9375rem", padding: "0.625rem 1.25rem" }}>
            Connect a repository
          </Link>

          {/* Feature grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "3.5rem", textAlign: "left" }}>
            {[
              { title: "Dependency graph", desc: "Real AST parsing via Tree-sitter. Neo4j stores the full call graph." },
              { title: "Vector search", desc: "Every function embedded with nomic-embed-text. Stored in ChromaDB." },
              { title: "Static analysis", desc: "Ruff, Bandit, Semgrep, Lizard — real linters, not LLM guesses." },
            ].map((f) => (
              <div key={f.title} className="card" style={{ textAlign: "left" }}>
                <h3 style={{ marginBottom: "0.375rem" }}>{f.title}</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: "1.5" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "1rem 1.5rem", textAlign: "center" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Open source. Runs entirely on your machine. No API key required.
        </span>
      </footer>
    </main>
  );
}
