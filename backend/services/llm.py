"""LLM inference via Ollama (default) or Groq (optional fallback)."""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import httpx
from config import settings


async def stream_chat(
    system_prompt: str,
    user_message: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Yield token strings from the LLM. Uses Groq if GROQ_API_KEY is set."""
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    if settings.groq_api_key:
        async for token in _stream_groq(messages):
            yield token
    else:
        async for token in _stream_ollama(messages):
            yield token


async def _stream_ollama(messages: list[dict]) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_host}/api/chat",
            json={"model": settings.ollama_chat_model, "messages": messages, "stream": True},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
                if data.get("done"):
                    break


async def _stream_groq(messages: list[dict]) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama3-70b-8192",
                "messages": messages,
                "stream": True,
            },
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    content = data["choices"][0].get("delta", {}).get("content", "")
                    if content:
                        yield content
