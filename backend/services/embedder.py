"""Ollama embedding service using nomic-embed-text."""
from __future__ import annotations

import httpx
from config import settings


async def embed(text: str) -> list[float]:
    """Return the embedding vector for a single text snippet."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.ollama_host}/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts, one at a time (Ollama has no batch endpoint)."""
    return [await embed(t) for t in texts]
