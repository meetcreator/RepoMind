"""GitHub REST API client + repo cloning."""
from __future__ import annotations

import subprocess
from pathlib import Path
import re
from urllib.parse import urlparse

import httpx


async def get_repo_meta(owner: str, repo: str, token: str | None = None) -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
        resp.raise_for_status()
        return resp.json()


async def list_user_repos(token: str) -> list[dict]:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            headers=headers,
            params={"per_page": 100, "sort": "updated"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_pull_request(owner: str, repo: str, pr_number: int, token: str | None = None) -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        resp.raise_for_status()
        pr = resp.json()

        files_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
            headers=headers,
        )
        files_resp.raise_for_status()
        pr["files"] = files_resp.json()
        return pr


def clone_repo(clone_url: str, dest_dir: str, token: str | None = None) -> None:
    """Shallow clone a repo into dest_dir. Injects token for private repos."""
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    url = clone_url
    if token and "github.com" in url:
        url = url.replace("https://", f"https://x-access-token:{token}@")
    subprocess.run(
        ["git", "clone", "--depth=1", "--single-branch", url, dest_dir],
        check=True,
        capture_output=True,
    )


def parse_github_url(url: str) -> tuple[str, str]:
    """Return (owner, repo) from a canonical public GitHub repository URL."""
    parsed = urlparse(url.strip())
    if parsed.scheme != "https" or parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        raise ValueError("Use an HTTPS GitHub URL, for example https://github.com/owner/repo")

    parts = [part for part in parsed.path.rstrip("/").removesuffix(".git").split("/") if part]
    if len(parts) != 2 or any(not re.fullmatch(r"[A-Za-z0-9_.-]+", part) for part in parts):
        raise ValueError("Use a GitHub repository URL in the form https://github.com/owner/repo")

    return parts[0], parts[1]
