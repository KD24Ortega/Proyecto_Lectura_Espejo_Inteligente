FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libpq-dev \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY utils/requirements.txt .

# Instalar dependencias de Python (incluye dlib)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir cmake && \
    pip install --no-cache-dir dlib && \
    pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY backend ./backend
COPY utils ./utils

EXPOSE $PORT

CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT