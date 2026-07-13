import chromadb
from config import settings

_client: chromadb.HttpClient | None = None


def get_client() -> chromadb.HttpClient:
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
    return _client


def get_collection(repo_id: str) -> chromadb.Collection:
    client = get_client()
    # One collection per repo, created on demand
    return client.get_or_create_collection(
        name=f"repo_{repo_id}",
        metadata={"hnsw:space": "cosine"},
    )
