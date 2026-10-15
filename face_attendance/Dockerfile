# ── Stage 1: build dlib (needs cmake + C++ toolchain) ────────────────────────
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        libopenblas-dev \
        liblapack-dev \
        libx11-dev \
        libgtk-3-dev \
        libboost-python-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /install

COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --prefix=/install/deps cmake \
 && pip install --prefix=/install/deps -r requirements.txt

# ── Stage 2: lean runtime image ───────────────────────────────────────────────
FROM python:3.11-slim

# Runtime shared libs needed by dlib/OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
        libopenblas0 \
        liblapack3 \
        libgomp1 \
        libglib2.0-0 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install/deps /usr/local

WORKDIR /app

# Copy application code
COPY . .

# Ensure the faces upload directory exists
RUN mkdir -p static/faces

# Non-root user for security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 5000

# $PORT is injected by Render; falls back to 5000 for local Docker
CMD gunicorn app:app \
    --bind "0.0.0.0:${PORT:-5000}" \
    --workers 1 \
    --timeout 120 \
    --preload
