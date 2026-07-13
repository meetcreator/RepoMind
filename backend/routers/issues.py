"""Static analysis issues endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from database.sqlite import get_session
from models.schemas import Issue, IssueResponse

router = APIRouter(prefix="/repos", tags=["issues"])


@router.get("/{repo_id}/issues", response_model=list[IssueResponse])
def get_issues(
    repo_id: str,
    tool: str | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Issue).where(Issue.repo_id == repo_id)
    if tool:
        stmt = stmt.where(Issue.tool == tool)
    if severity:
        stmt = stmt.where(Issue.severity == severity)
    if category:
        stmt = stmt.where(Issue.category == category)
    return session.exec(stmt.order_by(Issue.severity)).all()
