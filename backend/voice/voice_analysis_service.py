import librosa
import numpy as np
import soundfile as sf
from typing import Dict
import io

def analyze_voice(audio_bytes: bytes) -> Dict:
    """Analiza características acústicas de un audio"""
    
    # Cargar audio desde bytes
    audio_data, sr = sf.read(io.BytesIO(audio_bytes))
    
    # Si es estéreo, convertir a mono
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)
    
    # Características de voz
    
    # 1. PITCH (tono) - Depresión = tono bajo y monótono
    pitches, magnitudes = librosa.piptrack(y=audio_data, sr=sr)
    pitch_values = []
    for t in range(pitches.shape[1]):
        index = magnitudes[:, t].argmax()
        pitch = pitches[index, t]
        if pitch > 0:
            pitch_values.append(pitch)
    
    pitch_mean = float(np.mean(pitch_values)) if pitch_values else 0.0
    pitch_std = float(np.std(pitch_values)) if pitch_values else 0.0
    
    # 2. ENERGÍA - Depresión = baja energía
    energy = librosa.feature.rms(y=audio_data)[0]
    energy_mean = float(np.mean(energy))
    
    # 3. VELOCIDAD DEL HABLA - Depresión = habla lenta
    onset_frames = librosa.onset.onset_detect(y=audio_data, sr=sr)
    speech_rate = len(onset_frames) / (len(audio_data) / sr)  # onsets por segundo
    
    # 4. PAUSAS - Depresión = pausas largas
    intervals = librosa.effects.split(audio_data, top_db=20)
    if len(intervals) > 1:
        pause_durations = []
        for i in range(len(intervals) - 1):
            pause = (intervals[i+1][0] - intervals[i][1]) / sr
            pause_durations.append(pause)
        avg_pause = float(np.mean(pause_durations))
    else:
        avg_pause = 0.0
    
    # 5. VARIABILIDAD EMOCIONAL - Depresión = poca variación
    zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
    emotional_variability = float(np.std(zcr))
    
    # Clasificar riesgo
    risk_score = 0
    
    if pitch_mean < 150:  # Tono muy bajo
        risk_score += 2
    if pitch_std < 20:  # Muy monótono
        risk_score += 2
    if energy_mean < 0.01:  # Baja energía
        risk_score += 2
    if speech_rate < 2:  # Habla muy lenta
        risk_score += 2
    if avg_pause > 0.5:  # Pausas largas
        risk_score += 1
    if emotional_variability < 0.05:  # Poca variación
        risk_score += 1
    
    if risk_score >= 7:
        risk_level = "alto"
    elif risk_score >= 4:
        risk_level = "moderado"
    else:
        risk_level = "bajo"
    
    return {
        "pitch_mean": pitch_mean,
        "pitch_std": pitch_std,
        "energy_mean": energy_mean,
        "speech_rate": float(speech_rate),
        "pause_duration": avg_pause,
        "emotional_variability": emotional_variability,
        "risk_score": risk_score,
        "risk_level": risk_level
    }