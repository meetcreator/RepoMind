FROM python:3.11-slim

# Install system deps: git, curl, Node.js 20 (for ESLint)
RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl gnupg ca-certificates build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ESLint + TypeScript parser (used by analyzer service)
RUN npm install -g eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin --loglevel=error

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]
