# =====================================================
#  ANALIZADOR CLÍNICO DE VOZ - SCREENING SIN ML
#  Basado en Biomarcadores Vocales (2024)
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
BUFFER_SECONDS = 5
BUFFER_SAMPLES = SAMPLE_RATE * BUFFER_SECONDS
MICROPHONE_DEVICE_ID = 1

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
        pp = parselmouth.praat.call(sound, 
            "To PointProcess (periodic, cc)", 75, 300)

        jitter = parselmouth.praat.call(
            pp, "Get jitter (local)",
            0, 0, 0.0001, 0.02, 1.3)

        shimmer = parselmouth.praat.call(
            [sound, pp], "Get shimmer (local)",
            0, 0,
            0.0001, 0.02,
            1.3, 1.6)

        hnr = parselmouth.praat.call(
            sound, "Get harmonicity (cc)",
            0.01, 75, 0.1, 1.0)

    except:
        pass

    return jitter, shimmer, hnr


# =====================
# VAD WEBRTC
# =====================

def detectar_voz_ratio(y, sr):
    frames = librosa.util.frame(
        y,
        frame_length=int(sr * 0.03),
        hop_length=int(sr * 0.03)
    )

    voiced = 0

    for frame in frames.T:
        pcm = (frame * 32768).astype(np.int16)
        try:
            if vad.is_speech(pcm.tobytes(), sr):
                voiced += 1
        except:
            pass

    return voiced / frames.shape[1]


# =====================
# ANALIZADOR PRINCIPAL
# =====================

def analizar_voz_buffer(y, sr, genero="neutro"):

    y = butter_highpass_filter(y, 80, sr)

    genero = genero.lower()
    umbral = UMBRALES_TONO.get(genero, UMBRALES_TONO["neutro"])

    # ---------------------
    # PITCH
    # ---------------------
    f0, _, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7")
    )

    f0_valid = f0[~np.isnan(f0)]
    pitch_mean = np.mean(f0_valid) if f0_valid.size > 0 else 0
    pitch_std = np.std(f0_valid) if f0_valid.size > 0 else 0

    # ---------------------
    # ENERGIA
    # ---------------------
    rms = librosa.feature.rms(y=y)[0]
    energy_mean = np.mean(rms)

    # ---------------------
    # PAUSAS
    # ---------------------
    speech_ratio = detectar_voz_ratio(y, sr)

    # ---------------------
    # MFCC
    # ---------------------
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_variability = np.std(mfcc)

    # ---------------------
    # PRAAT
    # ---------------------
    jitter, shimmer, hnr = extraer_estabilidad_vocal(y, sr)

    # =====================
    # CLASIFICACION SCORE
    # =====================

    score = 0

    if pitch_mean < umbral["bajo"] or pitch_mean > umbral["alto"]:
        score += 1.5

    if pitch_std < umbral["monotonia"]:
        score += 1

    if energy_mean < 0.02:
        score += 1

    if speech_ratio < 0.3:
        score += 1

    if mfcc_variability < 10:
        score += 1

    if jitter > UMBRALES_ESTABILIDAD["jitter"]:
        score += 1

    if shimmer > UMBRALES_ESTABILIDAD["shimmer"]:
        score += 1

    if hnr < UMBRALES_ESTABILIDAD["hnr"]:
        score += 1.5

    # ---------------------
    # INTERPRETACION
    # ---------------------

    nivel = "Bajo 🟢"
    if score >= 6:
        nivel = "Alto 🔴"
    elif score >= 3:
        nivel = "Moderado 🟠"

    return {
        "Pitch": round(float(pitch_mean), 2),
        "Monotonía": round(float(pitch_std), 2),
        "Energía": round(float(energy_mean), 4),
        "VoiceRatio": round(float(speech_ratio), 2),
        "MFCCvar": round(float(mfcc_variability), 2),
        "Jitter": round(float(jitter), 4),
        "Shimmer": round(float(shimmer), 4),
        "HNR": round(float(hnr), 2),
        "Score": round(float(score), 2),
        "Riesgo": nivel
    }

# =====================
# STREAM EN TIEMPO REAL
# =====================

if __name__ == "__main__":

    print("\n--- 🎙️ ANALIZADOR CLÍNICO DE VOZ ---")
    print("Biomarcadores vocales en tiempo real")
    genero_usuario = "masculino"

    p = pyaudio.PyAudio()

    buffer_audio = np.zeros(BUFFER_SAMPLES, dtype=np.float32)

    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK,
        input_device_index=MICROPHONE_DEVICE_ID
    )

    print("🎤 Micrófono activado - Hable normalmente")
    print("Presione CTRL+C para salir.")
    print("-" * 100)

    try:
        while True:
            data = stream.read(CHUNK, exception_on_overflow=False)
            chunk = np.frombuffer(data, dtype=np.int16).astype(np.float32)
            chunk /= 32768.0

            shift = len(chunk)
            buffer_audio[:-shift] = buffer_audio[shift:]
            buffer_audio[-shift:] = chunk

            resultado = analizar_voz_buffer(buffer_audio, SAMPLE_RATE, genero=genero_usuario)

            if resultado["Pitch"] > 50:
                print(
                    f"Tono:{resultado['Pitch']:>6}Hz | "
                    f"Mono:{resultado['Monotonía']:>5} | "
                    f"Ener:{resultado['Energía']:>6} | "
                    f"Voz:{resultado['VoiceRatio']:>4} | "
                    f"Mfcc:{resultado['MFCCvar']:>5} | "
                    f"Jtr:{resultado['Jitter']:>6} | "
                    f"Shm:{resultado['Shimmer']:>6} | "
                    f"HNR:{resultado['HNR']:>5} | "
                    f"SCORE:{resultado['Score']:>5} | "
                    f"{resultado['Riesgo']:<8}",
                    end="\r"
                )

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\n--- 🛑 Análisis detenido ---")

    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()
