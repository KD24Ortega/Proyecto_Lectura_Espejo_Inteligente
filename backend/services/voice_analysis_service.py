# =====================================================
#  SERVICIO DE ANÁLISIS DE VOZ PARA SMART MIRROR
#  Integrado con FastAPI
# =====================================================

import librosa
import numpy as np
from scipy.signal import butter, lfilter
import parselmouth
import webrtcvad
import io
import base64
from typing import Dict, Optional

# =====================
# CONFIGURACIÓN GENERAL
# =====================

SAMPLE_RATE = 16000

# =====================
# UMBRALES POR GÉNERO
# =====================

UMBRALES_TONO = {
    "masculino": {"bajo": 115, "alto": 150, "monotonia": 18},
    "femenino":  {"bajo": 185, "alto": 230, "monotonia": 15},
    "neutro":    {"bajo": 150, "alto": 200, "monotonia": 16}
}

# =====================
# ESTABILIDAD VOCAL
# =====================

UMBRALES_ESTABILIDAD = {
    "jitter": 0.015,
    "shimmer": 0.04,
    "hnr": 15
}

vad = webrtcvad.Vad(2)

# =====================
# FILTRADO
# =====================

def butter_highpass_filter(data, cutoff, fs, order=5):
    """Filtro pasa-alto para eliminar ruido de baja frecuencia"""
    nyq = 0.5 * fs
    normal_cut = cutoff / nyq
    b, a = butter(order, normal_cut, btype='high', analog=False)
    return lfilter(b, a, data)


# =====================
# PRAAT FEATURES
# =====================

def extraer_estabilidad_vocal(y, sr):
    """
    Extrae jitter, shimmer y HNR usando Praat (Parselmouth)
    """
    sound = parselmouth.Sound(y, sr)
    jitter, shimmer, hnr = 0, 0, 0

    try:
        pp = parselmouth.praat.call(
            sound, "To PointProcess (periodic, cc)", 75, 300
        )

        jitter = parselmouth.praat.call(
            pp, "Get jitter (local)",
            0, 0, 0.0001, 0.02, 1.3
        )

        shimmer = parselmouth.praat.call(
            [sound, pp], "Get shimmer (local)",
            0, 0,
            0.0001, 0.02,
            1.3, 1.6
        )

        hnr = parselmouth.praat.call(
            sound, "Get harmonicity (cc)",
            0.01, 75, 0.1, 1.0
        )

    except Exception as e:
        print(f"Error extrayendo estabilidad vocal: {e}")
        pass

    return jitter, shimmer, hnr


# =====================
# VAD WEBRTC
# =====================

def detectar_voz_ratio(y, sr):
    """
    Calcula el ratio de frames con voz usando WebRTC VAD.
    """
    frame_length = int(sr * 0.03)  # 30 ms
    hop_length = frame_length

    if len(y) < frame_length:
        return 0.0

    frames = librosa.util.frame(
        y, frame_length=frame_length, hop_length=hop_length
    )

    voiced = 0

    for frame in frames.T:
        pcm = (frame * 32768).astype(np.int16)
        try:
            if vad.is_speech(pcm.tobytes(), sr):
                voiced += 1
        except Exception:
            pass

    total_frames = frames.shape[1]
    return voiced / total_frames if total_frames > 0 else 0.0


# =====================
# ANALIZADOR PRINCIPAL
# =====================

def analizar_voz_audio(audio_data: np.ndarray, sr: int, genero: str = "neutro") -> Dict:
    """
    Analiza un fragmento de audio y devuelve biomarcadores + nivel de riesgo.
    
    Args:
        audio_data: Array numpy con los datos de audio
        sr: Sample rate
        genero: "masculino", "femenino" o "neutro"
    
    Returns:
        Diccionario con los resultados del análisis
    """
    # 1) Filtrado pasa alto
    y = butter_highpass_filter(audio_data, 80, sr)

    # Ajustar umbrales por género
    genero = genero.lower()
    umbral = UMBRALES_TONO.get(genero, UMBRALES_TONO["neutro"])

    # 2) Pitch (F0)
    f0, _, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7")
    )
    f0_valid = f0[~np.isnan(f0)]
    pitch_mean = np.mean(f0_valid) if f0_valid.size > 0 else 0
    pitch_std = np.std(f0_valid) if f0_valid.size > 0 else 0

    # 3) Energía
    rms = librosa.feature.rms(y=y)[0]
    energy_mean = np.mean(rms)

    # 4) Voice Activity Ratio
    voice_ratio = detectar_voz_ratio(y, sr)

    # 5) MFCC (variabilidad espectral)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_variability = np.std(mfcc)

    # 6) Jitter, Shimmer, HNR (Praat)
    jitter, shimmer, hnr = extraer_estabilidad_vocal(y, sr)

    # =====================
    # SCORE BASADO EN REGLAS
    # =====================

    score = 0.0

    # Pitch extremo
    if pitch_mean < umbral["bajo"] or pitch_mean > umbral["alto"]:
        score += 1.5

    # Monotonía
    if pitch_std < umbral["monotonia"]:
        score += 1.0

    # Baja energía
    if energy_mean < 0.02:
        score += 1.0

    # Poca voz en el fragmento
    if voice_ratio < 0.3:
        score += 1.0

    # MFCC poco variable
    if mfcc_variability < 10:
        score += 1.0

    # Inestabilidad vocal
    if jitter > UMBRALES_ESTABILIDAD["jitter"]:
        score += 1.0

    if shimmer > UMBRALES_ESTABILIDAD["shimmer"]:
        score += 1.0

    # Voz poco armónica
    if hnr < UMBRALES_ESTABILIDAD["hnr"]:
        score += 1.5

    # Interpretación del nivel de riesgo
    nivel = "bajo"
    if score >= 6:
        nivel = "alto"
    elif score >= 3:
        nivel = "moderado"

    return {
        "pitch_mean": round(float(pitch_mean), 2),
        "pitch_std": round(float(pitch_std), 2),
        "energy": round(float(energy_mean), 4),
        "voice_ratio": round(float(voice_ratio), 2),
        "mfcc_variability": round(float(mfcc_variability), 2),
        "jitter": round(float(jitter), 4),
        "shimmer": round(float(shimmer), 4),
        "hnr": round(float(hnr), 2),
        "score": round(float(score), 2),
        "risk_level": nivel
    }


# =====================
# FUNCIÓN PARA PROCESAR AUDIO DESDE BASE64
# =====================

def procesar_audio_base64(audio_base64: str, genero: str = "neutro") -> Dict:
    """
    Procesa audio recibido en formato base64 desde el frontend.
    
    Args:
        audio_base64: String con el audio codificado en base64
        genero: "masculino", "femenino" o "neutro"
    
    Returns:
        Diccionario con los resultados del análisis
    """
    try:
        # Decodificar base64
        audio_bytes = base64.b64decode(audio_base64)
        
        # Cargar audio con librosa
        audio_data, sr = librosa.load(io.BytesIO(audio_bytes), sr=SAMPLE_RATE)
        
        # Analizar
        resultado = analizar_voz_audio(audio_data, sr, genero)
        
        return resultado
        
    except Exception as e:
        raise Exception(f"Error procesando audio: {str(e)}")


# =====================
# FUNCIÓN PARA PROCESAR ARCHIVO DE AUDIO
# =====================

def procesar_audio_archivo(archivo_bytes: bytes, genero: str = "neutro") -> Dict:
    """
    Procesa audio recibido como archivo desde el frontend.
    
    Args:
        archivo_bytes: Bytes del archivo de audio
        genero: "masculino", "femenino" o "neutro"
    
    Returns:
        Diccionario con los resultados del análisis
    """
    try:
        # Cargar audio con librosa
        audio_data, sr = librosa.load(io.BytesIO(archivo_bytes), sr=SAMPLE_RATE)
        
        # Analizar
        resultado = analizar_voz_audio(audio_data, sr, genero)
        
        return resultado
        
    except Exception as e:
        raise Exception(f"Error procesando audio: {str(e)}")