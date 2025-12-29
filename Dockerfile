FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

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
    # FFmpeg (básico, sin dev)
    ffmpeg \
    # OpenCV
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    # BLAS/LAPACK
    libopenblas-dev \
    liblapack-dev \
    # X11 y GTK
    libx11-dev \
    libgtk-3-dev \
    # Boost
    libboost-python-dev \
    libboost-thread-dev \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# COPIAR Y MODIFICAR REQUIREMENTS
# ============================================
COPY utils/requirements.txt requirements-original.txt

# Remover av y aiortc que causan problemas de compilación
RUN cat requirements-original.txt | \
    grep -v "^av==" | \
    grep -v "^aiortc==" > requirements.txt

# ============================================
# INSTALAR DEPENDENCIAS DE PYTHON
# ============================================

# Actualizar pip
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# Instalar dlib (10-15 min)
RUN pip install --no-cache-dir dlib==19.24.6 --verbose

# Verificar dlib
RUN python -c "import dlib; print('✓ dlib version:', dlib.__version__)"

# Instalar resto de dependencias
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# COPIAR CÓDIGO
# ============================================
COPY backend ./backend
COPY utils ./utils

# ============================================
# VERIFICACIONES
# ============================================
RUN python -c "import dlib; print('✓ dlib')" && \
    python -c "import face_recognition; print('✓ face_recognition')" && \
    python -c "import cv2; print('✓ opencv')" && \
    python -c "import mediapipe; print('✓ mediapipe')" && \
    python -c "import vosk; print('✓ vosk')" && \
    python -c "import librosa; print('✓ librosa')" && \
    python -c "print('✓ CORE FUNCIONALIDADES OK')"

EXPOSE $PORT

CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1