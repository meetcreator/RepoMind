"""SSE streaming chat endpoint."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from database.sqlite import engine
from models.schemas import ChatRequest, Repo
from services.graphrag import SYSTEM_PROMPT, build_context
from services.llm import stream_chat

router = APIRouter(prefix="/repos", tags=["chat"])


@router.post("/{repo_id}/chat")
async def chat(repo_id: str, body: ChatRequest):
    with Session(engine) as s:
        repo = s.get(Repo, repo_id)
    if not repo or repo.status != "ready":
        raise HTTPException(400, "Repo not ready for chat")

    context = await build_context(repo_id, body.message)
    history = [{"role": m.role, "content": m.content} for m in body.history]
    full_prompt = f"{context}\n\n---\nDeveloper question: {body.message}"

    async def event_stream():
        try:
            async for token in stream_chat(SYSTEM_PROMPT, full_prompt, history):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
