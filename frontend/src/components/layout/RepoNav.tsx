"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export function RepoNav() {
  const { data: session } = useSession();
  return (
    <nav className="nav">
      <Link href="/dashboard" className="nav-logo">RepoMind</Link>
      <Link href="/dashboard" className="nav-link">Repositories</Link>
      <Link href="/settings" className="nav-link" style={{ marginLeft: "auto" }}>Settings</Link>
      {session && (
        <button className="btn btn-ghost" style={{ fontSize: "0.8125rem" }} onClick={() => signOut()}>
          Sign out
        </button>
      )}
    </nav>
  );
}

export function RepoTabBar({ id }: { id: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview", href: `/repo/${id}` },
    { label: "Graph", href: `/repo/${id}/graph` },
    { label: "Chat", href: `/repo/${id}/chat` },
    { label: "Issues", href: `/repo/${id}/issues` },
    { label: "Docs", href: `/repo/${id}/docs` },
  ];

  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`tab ${pathname === t.href ? "active" : ""}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
