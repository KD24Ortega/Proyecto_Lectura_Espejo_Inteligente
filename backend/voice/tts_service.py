from gtts import gTTS
import io

class TTSService:
    def __init__(self):
        print("✓ Motor gTTS inicializado")
    
    def generate_audio_bytes(self, text: str) -> bytes:
        """Genera audio como bytes usando Google TTS"""
        tts = gTTS(text=text, lang='es', slow=False)
        
        # Guardar en memoria
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0)
        
        return audio_fp.read()