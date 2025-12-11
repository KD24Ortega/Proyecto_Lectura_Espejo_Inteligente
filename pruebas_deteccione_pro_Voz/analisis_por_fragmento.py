# =====================================================
#  ANALIZADOR DE VOZ POR FRAGMENTO (SIN ML)
#  Pulsa ENTER para grabar N segundos, luego analiza
# =====================================================

import librosa
import numpy as np
import pyaudio
import time
from scipy.signal import butter, lfilter
import parselmouth
import webrtcvad

# =====================
# CONFIGURACIÓN GENERAL
# =====================

SAMPLE_RATE = 16000
CHUNK = 1024

# Duración de la grabación (en segundos)
RECORD_SECONDS = 15  # <- puedes cambiarlo a 10, 20, etc.

MICROPHONE_DEVICE_ID = 1  # Ajusta si tu micrófono es otro índice

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
    nyq = 0.5 * fs
    normal_cut = cutoff / nyq
    b, a = butter(order, normal_cut, btype='high', analog=False)
    return lfilter(b, a, data)


# =====================
# PRAAT FEATURES
# =====================

def extraer_estabilidad_vocal(y, sr):
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

    except Exception:
        pass

    return jitter, shimmer, hnr


# =====================
# VAD WEBRTC
# =====================

def detectar_voz_ratio(y, sr):
    """
    Calcula el ratio de frames con voz usando WebRTC VAD.
    """
    # Frames de 30 ms
    frame_length = int(sr * 0.03)
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

    return voiced / frames.shape[1]


# =====================
# ANALIZADOR PRINCIPAL
# =====================

def analizar_voz_fragmento(y, sr, genero="neutro"):
    """
    Analiza un fragmento de audio y devuelve biomarcadores + nivel de riesgo.
    """
    # 1) Filtrado pasa alto
    y = butter_highpass_filter(y, 80, sr)

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

    # 4) Voice Activity Ratio (cuánta parte del fragmento es voz)
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

    # Interpretación
    nivel = "Bajo 🟢"
    if score >= 6:
        nivel = "Alto 🔴"
    elif score >= 3:
        nivel = "Moderado 🟠"

    return {
        "Pitch_mean_Hz": round(float(pitch_mean), 2),
        "Pitch_std": round(float(pitch_std), 2),
        "Energia_RMS": round(float(energy_mean), 4),
        "Voice_ratio": round(float(voice_ratio), 2),
        "MFCC_variability": round(float(mfcc_variability), 2),
        "Jitter": round(float(jitter), 4),
        "Shimmer": round(float(shimmer), 4),
        "HNR_dB": round(float(hnr), 2),
        "Score": round(float(score), 2),
        "Nivel_riesgo": nivel
    }


# =====================
# CAPTURA DE AUDIO POR BOTÓN
# =====================

def grabar_fragmento(segundos, sr=SAMPLE_RATE, device_id=MICROPHONE_DEVICE_ID):
    """
    Graba 'segundos' desde el micrófono y devuelve un numpy array float32.
    """
    p = pyaudio.PyAudio()

    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=sr,
        input=True,
        frames_per_buffer=CHUNK,
        input_device_index=device_id
    )

    print(f"\n🎙️ Grabando durante {segundos} segundos... Habla de forma continua.")
    frames = []
    num_chunks = int(sr / CHUNK * segundos)

    for _ in range(num_chunks):
        data = stream.read(CHUNK, exception_on_overflow=False)
        frames.append(data)

    stream.stop_stream()
    stream.close()
    p.terminate()

    # Unir y convertir a numpy
    audio_bytes = b"".join(frames)
    audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
    audio_np /= 32768.0  # normalizar a [-1, 1]

    return audio_np, sr


# =====================
# PROGRAMA PRINCIPAL
# =====================

if __name__ == "__main__":
    print("\n--- 🔬 ANALIZADOR DE VOZ POR FRAGMENTO ---")
    print("Este modo es más controlado que en vivo.")
    print(f"Se grabarán {RECORD_SECONDS} segundos cada vez.\n")

    # Configura aquí el género para los umbrales
    genero_usuario = "masculino"  # "femenino" o "neutro"

    while True:
        input("👉 Pulsa ENTER para iniciar la grabación...")

        # 1) Grabar fragmento
        y, sr = grabar_fragmento(RECORD_SECONDS, SAMPLE_RATE, MICROPHONE_DEVICE_ID)

        print("⌛ Analizando el fragmento grabado...")
        time.sleep(0.5)

        # 2) Analizar
        resultado = analizar_voz_fragmento(y, sr, genero=genero_usuario)

        # 3) Mostrar resumen
        print("\n===== RESULTADO DEL ANÁLISIS DE VOZ =====")
        print(f" Tono medio (F0):       {resultado['Pitch_mean_Hz']} Hz")
        print(f" Variabilidad tono:     {resultado['Pitch_std']}")
        print(f" Energía RMS:           {resultado['Energia_RMS']}")
        print(f" Proporción con voz:    {resultado['Voice_ratio']}")
        print(f" Variabilidad MFCC:     {resultado['MFCC_variability']}")
        print(f" Jitter:                {resultado['Jitter']}")
        print(f" Shimmer:               {resultado['Shimmer']}")
        print(f" HNR:                   {resultado['HNR_dB']} dB")
        print(f" Score total:           {resultado['Score']}")
        print(f" 🔎 Nivel de riesgo:    {resultado['Nivel_riesgo']}")
        print("=========================================\n")

        # Preguntar si desea repetir
        opc = input("¿Quieres grabar otro fragmento? (s/n): ").strip().lower()
        if opc != "s":
            print("\n👋 Fin del análisis.")
            break
