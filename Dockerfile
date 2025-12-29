FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# ============================================
# INSTALAR DEPENDENCIAS DEL SISTEMA PRIMERO
# ============================================
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
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
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Verificar que cmake del sistema esté instalado
RUN cmake --version

# ============================================
# COPIAR REQUIREMENTS
# ============================================
COPY utils/requirements.txt .

# ============================================
# INSTALAR PYTHON PACKAGES
# ORDEN CRÍTICO: pip, luego dlib, luego el resto
# ============================================

# 1. Actualizar pip
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# 2. IMPORTANTE: NO instalar cmake de pip
# El sistema ya tiene cmake instalado arriba

# 3. Instalar dlib (esto tomará 10-15 minutos)
RUN pip install --no-cache-dir dlib==19.24.6 --verbose

# 4. Verificar que dlib se instaló correctamente
RUN python -c "import dlib; print('dlib version:', dlib.__version__)"

# 5. Instalar el resto de dependencias
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# COPIAR CÓDIGO DE LA APLICACIÓN
# ============================================
COPY backend ./backend
COPY utils ./utils

# ============================================
# VERIFICAR INSTALACIONES CRÍTICAS
# ============================================
RUN python -c "import dlib; print('✓ dlib OK')" && \
    python -c "import face_recognition; print('✓ face_recognition OK')" && \
    python -c "import cv2; print('✓ opencv OK')" && \
    python -c "import mediapipe; print('✓ mediapipe OK')"

# ============================================
# EXPONER PUERTO
# ============================================
EXPOSE $PORT

# ============================================
# COMANDO DE INICIO
# ============================================
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1