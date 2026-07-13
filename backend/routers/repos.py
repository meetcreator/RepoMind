"""Repo CRUD + ingestion status + graph/overview endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from redis import Redis
from rq import Queue
from sqlmodel import Session, select

from config import settings
from database.neo4j import run_query
from database.sqlite import get_session
from models.schemas import (
    GraphData,
    GraphEdge,
    GraphNode,
    GraphNodeData,
    IssueResponse,
    OverviewResponse,
    OverviewStats,
    Repo,
    RepoCreateRequest,
    RepoResponse,
)
from services.github import parse_github_url, get_repo_meta

router = APIRouter(prefix="/repos", tags=["repos"])

_redis = Redis.from_url(settings.redis_url)
_queue = Queue("ingestion", connection=_redis)


@router.post("", response_model=RepoResponse, status_code=201)
async def add_repo(
    body: RepoCreateRequest,
    session: Session = Depends(get_session),
):
    try:
        owner, name = parse_github_url(body.github_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        meta = await get_repo_meta(owner, name)
    except Exception:
        if settings.public_repositories_only:
            raise HTTPException(
                status_code=400,
                detail="Only publicly accessible GitHub repositories can be analyzed.",
            )
        meta = {"clone_url": f"https://github.com/{owner}/{name}.git", "default_branch": "main"}

    if settings.public_repositories_only and meta.get("private", True):
        raise HTTPException(
            status_code=400,
            detail="Only public GitHub repositories can be analyzed.",
        )

    repo = Repo(
        github_url=body.github_url,
        name=name,
        owner=owner,
        user_id="local",  # replaced by real user_id once auth is wired
        default_branch=meta.get("default_branch", "main"),
    )
    session.add(repo)
    session.commit()
    session.refresh(repo)

    _queue.enqueue(
        "workers.ingestion.run_ingest",
        repo.id,
        meta.get("clone_url", body.github_url),
        None,  # github_token — injected by auth layer once wired
        job_timeout=3600,
    )
    return repo


@router.get("", response_model=list[RepoResponse])
def list_repos(session: Session = Depends(get_session)):
    return session.exec(select(Repo).order_by(Repo.created_at.desc())).all()


@router.get("/{repo_id}", response_model=RepoResponse)
def get_repo(repo_id: str, session: Session = Depends(get_session)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")
    return repo


@router.get("/{repo_id}/status")
def get_status(repo_id: str, session: Session = Depends(get_session)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404)
    return {"status": repo.status, "progress_msg": repo.progress_msg, "error": repo.error}


@router.get("/{repo_id}/graph", response_model=GraphData)
async def get_graph(repo_id: str):
    rows = await run_query(
        """
        MATCH (n)-[r]->(m)
        WHERE n.repoId = $rid AND m.repoId = $rid
        RETURN
            n.id AS nId, n.name AS nName, n.filePath AS nPath,
            n.startLine AS nSL, n.endLine AS nEL, n.language AS nLang,
            labels(n) AS nLabels,
            type(r) AS relType,
            m.id AS mId, m.name AS mName, m.filePath AS mPath,
            m.startLine AS mSL, m.endLine AS mEL, m.language AS mLang,
            labels(m) AS mLabels
        LIMIT 500
        """,
        rid=repo_id,
    )

    nodes_map: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []

    def add_node(nid: str, name: str, labels: list, path: str, sl: int, el: int, lang: str) -> None:
        if nid in nodes_map:
            return
        ntype = labels[0].lower() if labels else "file"
        nodes_map[nid] = GraphNode(
            id=nid,
            type=ntype,
            data=GraphNodeData(
                label=name or nid,
                type=ntype,
                file_path=path or "",
                start_line=sl or 0,
                end_line=el or 0,
                language=lang or "",
            ),
        )

    for row in rows:
        add_node(row["nId"], row["nName"], row["nLabels"], row["nPath"], row["nSL"], row["nEL"], row["nLang"])
        add_node(row["mId"], row["mName"], row["mLabels"], row["mPath"], row["mSL"], row["mEL"], row["mLang"])
        edges.append(GraphEdge(
            id=f"{row['nId']}-{row['relType']}-{row['mId']}",
            source=row["nId"],
            target=row["mId"],
            label=row["relType"],
        ))

    return GraphData(nodes=list(nodes_map.values()), edges=edges)



@router.get("/{repo_id}/overview", response_model=OverviewResponse)
async def get_overview(repo_id: str, session: Session = Depends(get_session)):
    file_count = await run_query("MATCH (f:File {repoId: $rid}) RETURN count(f) AS n", rid=repo_id)
    func_count = await run_query("MATCH (f:Function {repoId: $rid}) RETURN count(f) AS n", rid=repo_id)
    cls_count = await run_query("MATCH (c:Class {repoId: $rid}) RETURN count(c) AS n", rid=repo_id)

    from models.schemas import Issue
    from sqlmodel import select as sel
    issues = session.exec(sel(Issue).where(Issue.repo_id == repo_id)).all()
    error_count = sum(1 for i in issues if i.severity == "error")
    total_issues = len(issues)

    total_files = file_count[0]["n"] if file_count else 0
    total_funcs = func_count[0]["n"] if func_count else 0
    total_cls = cls_count[0]["n"] if cls_count else 0

    # Health score: start at 100, penalize errors heavily, warnings lightly
    health = max(0, 100 - error_count * 5 - (total_issues - error_count))
    health = min(100, health)

    # Build a simple Mermaid diagram from top-level imports
    import_rows = await run_query(
        """
        MATCH (f:File {repoId: $rid})-[:IMPORTS]->(m)
        RETURN f.name AS from, m.name AS to LIMIT 30
        """,
        rid=repo_id,
    )
    mermaid_lines = ["graph TD"]
    seen = set()
    for r in import_rows:
        edge = f'    {r["from"].replace(".", "_")} --> {r["to"].replace(".", "_")}'
        if edge not in seen:
            mermaid_lines.append(edge)
            seen.add(edge)
    if len(mermaid_lines) == 1:
        mermaid_lines.append("    RepoMind[No import data yet]")

    return OverviewResponse(
        stats=OverviewStats(
            total_files=total_files,
            total_functions=total_funcs,
            total_classes=total_cls,
            total_issues=total_issues,
            health_score=health,
        ),
        mermaid_diagram="\n".join(mermaid_lines),
        architecture_summary=f"This repository contains {total_files} files, {total_funcs} functions, and {total_cls} classes. {total_issues} static analysis findings were detected.",
    )
