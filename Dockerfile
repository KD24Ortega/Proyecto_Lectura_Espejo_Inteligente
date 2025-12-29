FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# ============================================
# INSTALAR TODAS LAS DEPENDENCIAS DEL SISTEMA
# ============================================
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    pkg-config \
    libpq-dev \
    # FFmpeg y sus librerías de desarrollo (CRÍTICO para av)
    ffmpeg \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libavfilter-dev \
    libswscale-dev \
    libswresample-dev \
    # OpenCV dependencies
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    # BLAS/LAPACK para numpy/scipy
    libopenblas-dev \
    liblapack-dev \
    # X11 y GTK para mediapipe
    libx11-dev \
    libgtk-3-dev \
    # Boost para dlib
    libboost-python-dev \
    libboost-thread-dev \
    && rm -rf /var/lib/apt/lists/*

# Verificar instalaciones del sistema
RUN cmake --version && \
    ffmpeg -version && \
    pkg-config --modversion libavformat

# ============================================
# COPIAR REQUIREMENTS
# ============================================
COPY utils/requirements.txt .

# ============================================
# INSTALAR DEPENDENCIAS DE PYTHON
# ============================================

# 1. Actualizar pip
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# 2. Instalar dlib (tarda 10-15 minutos)
RUN pip install --no-cache-dir dlib==19.24.6 --verbose

# 3. Verificar dlib
RUN python -c "import dlib; print('✓ dlib version:', dlib.__version__)"

# 4. Instalar el resto de dependencias
# av ahora debería compilar correctamente con las librerías de ffmpeg
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# COPIAR CÓDIGO
# ============================================
COPY backend ./backend
COPY utils ./utils

# ============================================
# VERIFICAR INSTALACIONES CRÍTICAS
# ============================================
RUN python -c "import dlib; print('✓ dlib')" && \
    python -c "import face_recognition; print('✓ face_recognition')" && \
    python -c "import cv2; print('✓ opencv')" && \
    python -c "import mediapipe; print('✓ mediapipe')" && \
    python -c "import av; print('✓ av')" && \
    python -c "import vosk; print('✓ vosk')" && \
    python -c "import librosa; print('✓ librosa')"

# ============================================
# EXPONER PUERTO
# ============================================
EXPOSE $PORT

# ============================================
# COMANDO DE INICIO
# ============================================
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1