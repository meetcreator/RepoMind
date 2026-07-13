"""PR review endpoint."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from models.schemas import PRFileChange, PRReviewResponse
from services.github import get_pull_request, parse_github_url
from services.graphrag import build_context
from services.llm import stream_chat

router = APIRouter(prefix="/repos", tags=["prs"])


@router.get("/{repo_id}/prs/{pr_number}", response_model=PRReviewResponse)
async def get_pr_review(
    repo_id: str,
    pr_number: int,
    github_url: str = Query(...),
    token: str | None = Query(None),
):
    owner, name = parse_github_url(github_url)
    pr = await get_pull_request(owner, name, pr_number, token)
    files = [
        PRFileChange(
            filename=f["filename"],
            status=f["status"],
            additions=f.get("additions", 0),
            deletions=f.get("deletions", 0),
            patch=f.get("patch", ""),
        )
        for f in pr.get("files", [])
    ]

    diff_text = "\n".join(
        f"### {f.filename}\n```diff\n{f.patch}\n```" for f in files if f.patch
    )
    context = await build_context(repo_id, diff_text[:2000], top_k=5)
    prompt = f"{context}\n\nReview this PR diff and provide specific, actionable feedback:\n\n{diff_text[:3000]}"

    comments: list[str] = []
    async for token_str in stream_chat(
        "You are a senior engineer doing a thorough code review. Be specific and grounded in the code shown.",
        prompt,
    ):
        comments.append(token_str)

    return PRReviewResponse(
        pr_number=pr_number,
        title=pr.get("title", ""),
        body=pr.get("body", ""),
        files=files,
        ai_comments=["".join(comments)],
    )
