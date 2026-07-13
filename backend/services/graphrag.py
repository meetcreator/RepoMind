"""GraphRAG pipeline: vector search + graph expansion + LLM context assembly."""
from __future__ import annotations

from database.chroma import get_collection
from database.neo4j import run_query
from services.embedder import embed


SYSTEM_PROMPT = """You are RepoMind, an expert code analyst. You have been given
relevant code snippets and graph relationships from a real repository. Answer the
developer's question with precise, grounded responses. Cite specific file paths
and line numbers when relevant. Never hallucinate API names or function
signatures — only reference what appears in the provided context."""


async def build_context(repo_id: str, question: str, top_k: int = 8) -> str:
    """Return an assembled context string for the LLM."""
    # 1. Embed the question
    q_vector = await embed(question)

    # 2. Vector search in Chroma
    collection = get_collection(repo_id)
    results = collection.query(
        query_embeddings=[q_vector],
        n_results=min(top_k, collection.count() or 1),
        include=["documents", "metadatas"],
    )

    chunks: list[str] = []
    node_ids: list[str] = []

    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        fp = meta.get("file_path", "")
        sl = meta.get("start_line", "?")
        el = meta.get("end_line", "?")
        chunks.append(f"### {fp} (lines {sl}–{el})\n```\n{doc}\n```")
        nid = meta.get("node_id")
        if nid:
            node_ids.append(nid)

    # 3. Expand 1-hop graph neighbors from matched node IDs
    graph_context = ""
    if node_ids:
        rows = await run_query(
            """
            MATCH (n)-[r]->(m)
            WHERE n.id IN $ids
            RETURN n.name AS from, type(r) AS rel, m.name AS to,
                   m.filePath AS toPath, m.startLine AS toLine
            LIMIT 40
            """,
            ids=node_ids,
        )
        if rows:
            lines = [f"- {r['from']} --[{r['rel']}]--> {r['to']} ({r.get('toPath','?')}:{r.get('toLine','?')})" for r in rows]
            graph_context = "\n## Graph Relationships\n" + "\n".join(lines)

    code_context = "\n\n".join(chunks)
    return f"## Relevant Code\n{code_context}{graph_context}"
