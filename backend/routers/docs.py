"""Documentation endpoints."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from database.sqlite import get_session
from models.schemas import Doc, DocResponse
from services.llm import stream_chat

router = APIRouter(prefix="/repos", tags=["docs"])


@router.get("/{repo_id}/docs", response_model=list[DocResponse])
def get_docs(repo_id: str, session: Session = Depends(get_session)):
    return session.exec(select(Doc).where(Doc.repo_id == repo_id)).all()


@router.post("/{repo_id}/docs/regenerate")
async def regenerate_doc(
    repo_id: str,
    body: dict,
    session: Session = Depends(get_session),
):
    """Regenerate a specific doc entry by node_id (passed in body)."""
    node_id = body.get("node_id")
    if not node_id:
        raise HTTPException(400, "node_id required")

    doc = session.exec(
        select(Doc).where(Doc.repo_id == repo_id, Doc.node_id == node_id)
    ).first()
    if not doc:
        raise HTTPException(404, "Doc not found")

    async def stream():
        parts: list[str] = []
        async for token in stream_chat(
            "You are a technical documentation writer.",
            f"Rewrite and improve the documentation for: {doc.name}\n\nCurrent:\n{doc.content}",
        ):
            parts.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"

        doc.content = "".join(parts)
        session.add(doc)
        session.commit()
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
