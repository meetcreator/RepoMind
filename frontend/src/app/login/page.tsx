"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { getProviders, signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "GitHub OAuth credentials not set. Use Dev Login below to continue.",
  OAuthSignin: "GitHub OAuth is not configured. See README for setup.",
  OAuthCallback: "GitHub OAuth callback error. Check your callback URL.",
  OAuthAccountNotLinked: "Account already linked to another sign-in.",
  default: "An error occurred during sign in.",
};
const isDevelopment = process.env.NODE_ENV === "development";
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const publicRepositoriesMode =
  process.env.NEXT_PUBLIC_PUBLIC_REPOSITORIES_MODE === "true";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [devLoading, setDevLoading] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  useEffect(() => {
    getProviders()
      .then((providers) => setGithubEnabled(Boolean(providers?.github)))
      .catch(() => setGithubEnabled(false));
  }, []);

  const handleDevLogin = async () => {
    setDevLoading(true);
    const res = await signIn("dev-login", { redirect: false });
    if (res?.ok) router.replace("/dashboard");
    else setDevLoading(false);
  };



  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="card" style={{ width: "380px", padding: "2rem", textAlign: "center" }}>
        <p className="nav-logo" style={{ display: "block", marginBottom: "0.25rem", fontSize: "1.25rem" }}>RepoMind</p>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.75rem" }}>
          Connect GitHub repos and ask questions about your code.
        </p>

        {error && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            padding: "0.625rem 0.875rem",
            marginBottom: "1rem",
            fontSize: "0.8125rem",
            color: "var(--error)",
            textAlign: "left",
          }}>
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}
          </div>
        )}

        {githubEnabled ? (
          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", gap: "0.5rem", padding: "0.625rem", marginBottom: "0.75rem" }}
            onClick={() => signIn("github")}
          >
            <GitHubIcon />
            Sign in with GitHub
          </button>
        ) : githubEnabled === false ? (
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: (demoMode || publicRepositoriesMode) ? "0.75rem" : 0 }}>
              GitHub sign-in has not been configured for this deployment.
            </p>
            {publicRepositoriesMode ? (
              <Link href="/dashboard" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Continue with public repositories
              </Link>
            ) : demoMode ? (
              <Link href="/dashboard" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Continue in demo mode
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Dev bypass — shown when real OAuth isn't configured */}
        <button
          className="btn"
          style={{
            width: "100%",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.625rem",
            border: "1px dashed var(--border)",
            background: "#f9fafb",
            color: "var(--text-muted)",
            fontSize: "0.8125rem",
            opacity: devLoading ? 0.7 : 1,
          }}
          onClick={handleDevLogin}
          disabled={!isDevelopment || devLoading}
        >
          {devLoading ? "Signing in…" : "⚡ Dev Login (no credentials needed)"}
        </button>

        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1.25rem" }}>
          GitHub OAuth requires a free OAuth App. See README for setup.
        </p>
      </div>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}
