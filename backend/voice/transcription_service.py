from vosk import Model, KaldiRecognizer
import json
import wave
import io
import subprocess
import tempfile
import os

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
        text = text.lower().strip()
        
        if any(word in text for word in ["nada", "nunca", "no", "cero", "ningún"]):
            return 0
        elif any(word in text for word in ["varios", "algunos", "pocos", "uno", "dos", "1", "2"]):
            return 1
        elif any(word in text for word in ["mitad", "medio", "bastante", "tres", "3"]):
            return 2
        elif any(word in text for word in ["siempre", "todos", "diario", "mucho", "cuatro", "4"]):
            return 3
        
        return 0