"""RQ ingestion worker: clone → parse → Neo4j + Chroma → static analysis."""
from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, select

from config import settings
from database import chroma as chroma_db
from database import neo4j as neo4j_db
from database.sqlite import engine
from models.schemas import Doc, Issue, Repo
from services import analyzer, embedder, parser
from services.github import clone_repo
from services.llm import stream_chat


def _update_repo(repo_id: str, **kwargs) -> None:
    with Session(engine) as s:
        repo = s.get(Repo, repo_id)
        if repo:
            for k, v in kwargs.items():
                setattr(repo, k, v)
            s.add(repo)
            s.commit()


async def _write_neo4j(repo_id: str, parsed_files: list[parser.ParsedFile]) -> None:
    # Constraints (idempotent)
    await neo4j_db.run_query(
        "CREATE CONSTRAINT file_id IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE"
    )
    await neo4j_db.run_query(
        "CREATE CONSTRAINT func_id IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE"
    )
    await neo4j_db.run_query(
        "CREATE CONSTRAINT class_id IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE"
    )

    for pf in parsed_files:
        file_id = f"{repo_id}:{pf.path}"
        await neo4j_db.run_query(
            """
            MERGE (f:File {id: $id})
            SET f.name = $name, f.filePath = $path, f.language = $lang, f.repoId = $rid
            """,
            id=file_id, name=Path(pf.path).name, path=pf.path, lang=pf.language, rid=repo_id,
        )

        for func in pf.functions:
            node_id = f"{file_id}:{func.name}:{func.start_line}"
            await neo4j_db.run_query(
                """
                MERGE (fn:Function {id: $id})
                SET fn.name = $name, fn.filePath = $path,
                    fn.startLine = $sl, fn.endLine = $el,
                    fn.language = $lang, fn.repoId = $rid
                WITH fn
                MATCH (fi:File {id: $fid})
                MERGE (fn)-[:DEFINED_IN]->(fi)
                """,
                id=node_id, name=func.name, path=pf.path,
                sl=func.start_line, el=func.end_line, lang=pf.language,
                rid=repo_id, fid=file_id,
            )

        for cls in pf.classes:
            node_id = f"{file_id}:{cls.name}:{cls.start_line}"
            await neo4j_db.run_query(
                """
                MERGE (c:Class {id: $id})
                SET c.name = $name, c.filePath = $path,
                    c.startLine = $sl, c.endLine = $el,
                    c.language = $lang, c.repoId = $rid
                WITH c
                MATCH (fi:File {id: $fid})
                MERGE (c)-[:DEFINED_IN]->(fi)
                """,
                id=node_id, name=cls.name, path=pf.path,
                sl=cls.start_line, el=cls.end_line, lang=pf.language,
                rid=repo_id, fid=file_id,
            )


async def _embed_and_store(repo_id: str, parsed_files: list[parser.ParsedFile]) -> None:
    collection = chroma_db.get_collection(repo_id)
    docs, metas, ids, embeddings = [], [], [], []

    for pf in parsed_files:
        file_id = f"{repo_id}:{pf.path}"
        chunks: list[tuple[str, str, int, int]] = []  # (text, node_id, start, end)

        for func in pf.functions:
            nid = f"{file_id}:{func.name}:{func.start_line}"
            chunks.append((func.body, nid, func.start_line, func.end_line))

        for cls in pf.classes:
            nid = f"{file_id}:{cls.name}:{cls.start_line}"
            chunks.append((cls.body, nid, cls.start_line, cls.end_line))

        for text, node_id, sl, el in chunks:
            if not text.strip():
                continue
            vec = await embedder.embed(text)
            chunk_id = str(uuid.uuid4())
            docs.append(text)
            metas.append({
                "repo_id": repo_id,
                "file_path": pf.path,
                "start_line": sl,
                "end_line": el,
                "node_id": node_id,
                "language": pf.language,
            })
            ids.append(chunk_id)
            embeddings.append(vec)

            # Also update the Neo4j node with the chunkId
            await neo4j_db.run_query(
                "MATCH (n {id: $nid}) SET n.chunkId = $cid",
                nid=node_id, cid=chunk_id,
            )

    if docs:
        collection.add(documents=docs, metadatas=metas, ids=ids, embeddings=embeddings)


async def _generate_docs(repo_id: str, parsed_files: list[parser.ParsedFile]) -> None:
    with Session(engine) as s:
        for pf in parsed_files:
            file_id = f"{repo_id}:{pf.path}"
            for func in pf.functions[:20]:  # cap to avoid very long ingestion
                node_id = f"{file_id}:{func.name}:{func.start_line}"
                prompt = f"Write a concise technical docstring for this function:\n\n{func.body}"
                content_parts: list[str] = []
                async for token in stream_chat("You are a technical documentation writer.", prompt):
                    content_parts.append(token)
                doc = Doc(
                    repo_id=repo_id,
                    node_id=node_id,
                    node_type="function",
                    name=func.name,
                    file_path=pf.path,
                    content="".join(content_parts),
                )
                s.add(doc)
            s.commit()


async def ingest_repo(repo_id: str, clone_url: str, github_token: str | None = None) -> None:
    """Main RQ job: full ingestion pipeline."""
    dest = os.path.join(settings.repo_clone_dir, repo_id)

    try:
        _update_repo(repo_id, status="analyzing", progress_msg="Cloning repository...")
        clone_repo(clone_url, dest, github_token)

        _update_repo(repo_id, progress_msg="Parsing source files...")
        parsed_files = parser.walk_repo(dest)
        _update_repo(repo_id, progress_msg=f"Parsed {len(parsed_files)} files. Writing to graph DB...")

        await _write_neo4j(repo_id, parsed_files)

        _update_repo(repo_id, progress_msg="Embedding code chunks...")
        await _embed_and_store(repo_id, parsed_files)

        _update_repo(repo_id, progress_msg="Running static analysis...")
        findings = analyzer.run_all(dest)
        with Session(engine) as s:
            for f in findings:
                s.add(Issue(repo_id=repo_id, **f))
            s.commit()

        _update_repo(repo_id, progress_msg="Generating documentation...")
        await _generate_docs(repo_id, parsed_files)

        _update_repo(
            repo_id,
            status="ready",
            progress_msg=f"Analysis complete. {len(parsed_files)} files, {len(findings)} issues.",
            analyzed_at=datetime.utcnow(),
        )
    except Exception as exc:
        _update_repo(repo_id, status="failed", error=str(exc))
        raise


def run_ingest(repo_id: str, clone_url: str, github_token: str | None = None) -> None:
    """Synchronous RQ entry point — wraps the async pipeline with asyncio.run()."""
    import asyncio
    asyncio.run(ingest_repo(repo_id, clone_url, github_token))

