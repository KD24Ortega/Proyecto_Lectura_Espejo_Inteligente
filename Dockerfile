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

# Remover av y aiortc que causan problemas
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
RUN python -c "import dlib; print('✓ dlib')" && \
    python -c "import face_recognition; print('✓ face_recognition')" && \
    python -c "import cv2; print('✓ opencv')" && \
    python -c "import mediapipe; print('✓ mediapipe')" && \
    python -c "import vosk; print('✓ vosk')" && \
    python -c "import librosa; print('✓ librosa')" && \
    python -c "print('✓ TODAS LAS FUNCIONALIDADES CORE OK')"

EXPOSE 8000

# ============================================
# COMANDO DE INICIO (CORREGIDO)
# Usar ENTRYPOINT + CMD para que las variables se expandan correctamente
# ============================================
ENTRYPOINT ["sh", "-c"]
CMD ["uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]