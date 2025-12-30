FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV WEB_CONCURRENCY=2

# Evita oversubscription de CPU en NumPy/BLAS/OpenMP (importante con 1GB RAM y 2 vCPU)
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1

# Límites de concurrencia por worker para cargas pesadas
ENV FACE_RECOGNITION_CONCURRENCY=1
ENV VOICE_ANALYSIS_CONCURRENCY=1
ENV VOICE_TRANSCRIBE_CONCURRENCY=1

# Pool de DB por worker (conservador). Ajusta en Railway si tu Postgres lo permite.
ENV DB_POOL_SIZE=2
ENV DB_MAX_OVERFLOW=2
ENV DB_POOL_TIMEOUT=30
ENV DB_POOL_RECYCLE=1800

WORKDIR /app

# ============================================
# INSTALAR DEPENDENCIAS DEL SISTEMA
# ============================================
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    pkg-config \
    libpq-dev \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libboost-python-dev \
    libboost-thread-dev \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# COPIAR Y MODIFICAR REQUIREMENTS
# ============================================
COPY utils/requirements.txt requirements-original.txt

# Remover av y aiortc
RUN cat requirements-original.txt | \
    grep -v "^av==" | \
    grep -v "^aiortc==" > requirements.txt

# ============================================
# INSTALAR DEPENDENCIAS DE PYTHON
# ============================================
RUN pip install --no-cache-dir --upgrade pip wheel setuptools
RUN pip install --no-cache-dir dlib==19.24.6 --verbose
RUN python -c "import dlib; print('✓ dlib version:', dlib.__version__)"
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# COPIAR CÓDIGO
# ============================================
COPY backend ./backend
COPY utils ./utils

# ============================================
# VERIFICACIONES
# ============================================
RUN python -c "import dlib, face_recognition, cv2, mediapipe, vosk, librosa; print('✓ TODO OK')"

# ============================================
# EXPONER PUERTO (Railway usa PORT)
# ============================================
EXPOSE 8000

# ============================================
# COMANDO DE INICIO - EXPANDE PORT
# ============================================
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-4}"]
