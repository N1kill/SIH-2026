FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY scripts/build_frontend.mjs scripts/build_frontend.mjs

COPY frontend-dam/ frontend-dam/
COPY outputs/3d/dashboard/ outputs/3d/dashboard/
COPY data/candidates/ data/candidates/
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements-agent.txt requirements-core.txt ./
RUN pip install --no-cache-dir -r requirements-agent.txt
COPY src/ src/
COPY scripts/research_dam.py scripts/research_dam.py
COPY server.py config.json ./
COPY data/ data/

COPY --from=frontend /build/frontend-dam/dist/ frontend-dam/dist/
COPY --from=frontend /build/outputs/3d/dashboard/ outputs/3d/dashboard/
ENV MALLOC_ARENA_MAX=2
ENV PYTHONUNBUFFERED=1
EXPOSE 8050
CMD ["python","-m","uvicorn","server:app","--host","0.0.0.0","--port","8050","--workers","1"]
