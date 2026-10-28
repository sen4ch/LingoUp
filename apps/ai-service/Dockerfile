# syntax=docker/dockerfile:1
FROM python:3.14-slim-trixie AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

FROM base AS test
COPY pyproject.toml ./
COPY app ./app
RUN pip install ".[dev]"
COPY tests ./tests
RUN ruff check . && ruff format --check . && pytest -q

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
COPY app ./app
RUN pip install ".[recognition]" && useradd --system --uid 10001 appuser && mkdir /models && chown appuser /models
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "20"]
