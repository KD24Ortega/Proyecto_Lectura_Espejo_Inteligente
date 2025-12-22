import { useRef, useEffect, useState } from 'react';

function Camera({ onCapture, isActive = true, hidden = false }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const stopCamera = () => {
      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    };

    // Si se desactiva, detener inmediatamente
    if (!isActive) {
      stopCamera();
      return;
    }

    // Iniciar c1mara
    const startCamera = async () => {
      try {
        // Evitar streams duplicados si el efecto se re-ejecuta
        stopCamera();

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError(null);
      } catch (err) {
        console.error('Error al acceder a la c1mara:', err);
        setError('No se pudo acceder a la c1mara. Verifica los permisos.');
      }
    };

    startCamera();

    // Cleanup: detener c1mara al desmontar o cambiar isActive
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isActive]);

  // Capturar frame de la cámara
  const captureFrame = () => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    return canvas.toDataURL('image/jpeg');
  };

  // Ejecutar captura automática cada X segundos (si onCapture está definido)
  useEffect(() => {
    if (!onCapture || !isActive) return;

    const interval = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        onCapture(frame);
      }
    }, 1500); // Capturar cada 1.5 segundos

    return () => clearInterval(interval);
  }, [onCapture, isActive]);

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  // Si hidden = true, ocultar con OPACITY pero mantener renderizado
  if (hidden) {
    return (
      <div className="fixed bottom-0 right-0 w-1 h-1 opacity-0 pointer-events-none overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '640px', height: '480px' }}
        />
      </div>
    );
  }

  // Visible (para login en Welcome)
  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-lg shadow-lg transform -scale-x-100" // Espejo
      />
      <div className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm">
        ● REC
      </div>
    </div>
  );
}

export default Camera;