#!/bin/bash
set -e

# Start Ollama server in background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait until the API is accepting requests
echo "[ollama] Waiting for server to start..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done
echo "[ollama] Server is up."

# Pull models (skipped automatically if already cached in volume)
echo "[ollama] Pulling nomic-embed-text..."
ollama pull nomic-embed-text

echo "[ollama] Pulling qwen2.5-coder:7b..."
ollama pull qwen2.5-coder:7b

echo "[ollama] All models ready."
wait $OLLAMA_PID
