# ---- Stage 1: build the React/Vite frontend (includes the 64MB GLB from public/) ----
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build            # -> /web/dist

# ---- Stage 2: Python runtime serving the API + static frontend ----
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend code + knowledge base (paths are resolved relative to /app by kb.py/agent.py)
COPY app/ ./app/
COPY car_configurations.json tools.json system_prompt.md ./

# Built frontend -> served by FastAPI at "/"
COPY --from=web /web/dist ./static

ENV MILES_STATIC_DIR=/app/static \
    MILES_MEMORY_PATH=/tmp/miles_memory.json \
    PORT=8080

# Cloud Run sets $PORT; bind 0.0.0.0. uvicorn[standard] includes the WebSocket impl.
CMD ["sh", "-c", "uvicorn app.web:app --host 0.0.0.0 --port ${PORT}"]
