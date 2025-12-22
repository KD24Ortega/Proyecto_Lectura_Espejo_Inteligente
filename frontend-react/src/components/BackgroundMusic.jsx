import { useEffect, useRef, useState } from 'react';

function BackgroundMusic({ musicFile, volume = 0.3 }) {
  const audioRef = useRef(null);
  const userPausedRef = useRef(false);
  const autoPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!musicFile) return;

    const audio = new Audio(musicFile);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    userPausedRef.current = false;
    autoPausedRef.current = false;
    setHasError(false);

    audio.onerror = () => {
      console.warn('No se pudo cargar el archivo de audio:', musicFile);
      setHasError(true);
      setIsPlaying(false);
    };

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((err) => {
        // Suele pasar por políticas de autoplay. Se reproducirá cuando haya interacción del usuario.
        console.log('Autoplay bloqueado:', err?.message || err);
        setIsPlaying(false);
      });

    const handlePause = () => {
      if (!audioRef.current) return;
      if (!audioRef.current.paused) {
        autoPausedRef.current = true;
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handleResume = () => {
      if (!audioRef.current) return;
      // Solo reanudar si fue una pausa automática (ej: micrófono), y el usuario no la pausó manualmente.
      if (autoPausedRef.current && !userPausedRef.current) {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            autoPausedRef.current = false;
          })
          .catch((err) => {
            console.log('Error al reanudar música:', err?.message || err);
          });
      }
    };

    window.addEventListener('bgm:pause', handlePause);
    window.addEventListener('bgm:resume', handleResume);

    return () => {
      window.removeEventListener('bgm:pause', handlePause);
      window.removeEventListener('bgm:resume', handleResume);
      audio.pause();
      audio.src = '';
    };
  }, [musicFile, volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      userPausedRef.current = true;
      autoPausedRef.current = false;
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.log('Error al reproducir:', err?.message || err);
          setIsPlaying(false);
        });
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