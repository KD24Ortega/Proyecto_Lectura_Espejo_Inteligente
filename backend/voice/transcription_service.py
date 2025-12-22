from vosk import Model, KaldiRecognizer
import json
import wave
import io
import subprocess
import tempfile
import os
import re
import unicodedata

class TranscriptionService:
    def __init__(self):
        model_path = "backend/voice/models/vosk-model-small-es-0.42"
        self.model = Model(model_path)
        print(f"✓ Modelo Vosk cargado desde {model_path}")
    
    def transcribe(self, audio_bytes: bytes) -> dict:
        """Transcribe audio a texto"""
        
        # Convertir a WAV 16kHz mono usando ffmpeg
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f_in:
            f_in.write(audio_bytes)
            input_file = f_in.name
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f_out:
            output_file = f_out.name
        
        try:
            # Convertir con ffmpeg
            subprocess.run([
                'ffmpeg', '-i', input_file,
                '-ar', '16000',  # 16kHz
                '-ac', '1',      # Mono
                '-f', 'wav',
                '-y',
                output_file
            ], check=True, capture_output=True)
            
            # Transcribir
            wf = wave.open(output_file, "rb")
            rec = KaldiRecognizer(self.model, wf.getframerate())
            
            result_text = ""
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    result = json.loads(rec.Result())
                    result_text += result.get("text", "")
            
            final = json.loads(rec.FinalResult())
            result_text += final.get("text", "")
            
            wf.close()
            
            return {"text": result_text.strip(), "confidence": 1.0}
            
        finally:
            os.remove(input_file)
            os.remove(output_file)
    
    def map_response_to_score(self, text: str) -> int:
        """Mapea texto a puntuación 0-3"""
        if not text:
            return 0

        text = text.lower().strip()

        # Normalizar acentos para mejorar coincidencias (ningún -> ningun)
        normalized = unicodedata.normalize("NFKD", text)
        normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))

        # 1) Prioridad: el usuario dice explícitamente el número 0-3
        m = re.search(r"\b([0-3])\b", normalized)
        if m:
            return int(m.group(1))

        # 2) Palabras numéricas (español) para 0-3
        number_words = {
            0: ["cero", "nada", "ninguno", "ninguna", "ningun"],
            1: ["uno", "una"],
            2: ["dos"],
            3: ["tres"],
        }
        for score, words in number_words.items():
            for w in words:
                if re.search(rf"\b{re.escape(w)}\b", normalized):
                    return score

        # 3) Heurísticas por frase (fallback)
        if any(phrase in normalized for phrase in [
            "ningun dia",
            "ninguna vez",
            "nunca",
        ]):
            return 0

        if any(phrase in normalized for phrase in [
            "varios dias",
            "algunos dias",
            "pocos dias",
        ]):
            return 1

        if any(phrase in normalized for phrase in [
            "mas de la mitad",
            "la mitad",
            "medio",
            "bastante",
        ]):
            return 2

        if any(phrase in normalized for phrase in [
            "casi todos",
            "todos los dias",
            "siempre",
            "diario",
            "mucho",
        ]):
            return 3

        # 4) Último recurso: mantener compatibilidad con el viejo mapeo de 'cuatro/4' -> 3
        if re.search(r"\b(4|cuatro)\b", normalized):
            return 3

        return 0