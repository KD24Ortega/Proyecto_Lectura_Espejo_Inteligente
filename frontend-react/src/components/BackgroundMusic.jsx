import { useEffect, useRef, useState } from 'react';

function BackgroundMusic({ musicFile, volume = 0.3 }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!musicFile) return;

    const audio = new Audio(musicFile);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    audio.onerror = () => {
      console.warn('No se pudo cargar el archivo de audio:', musicFile);
      setHasError(true);
    };

    audio.play().catch(err => {
      console.log('Autoplay bloqueado:', err.message);
      setIsPlaying(false);
    });

    setIsPlaying(true);

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [musicFile, volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => {
        console.log('Error al reproducir:', err.message);
      });
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;

    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  if (!musicFile || hasError) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex space-x-2">
      <button
        onClick={togglePlay}
        className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:scale-110 transition-transform"
        title={isPlaying ? 'Pausar música' : 'Reproducir música'}
      >
        {isPlaying ? '⏸️' : '▶️'}
      </button>

      <button
        onClick={toggleMute}
        className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:scale-110 transition-transform"
        title={isMuted ? 'Activar sonido' : 'Silenciar'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

export default BackgroundMusic;