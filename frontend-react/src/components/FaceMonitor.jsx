import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import Camera from './Camera';

function FaceMonitor({ isActive = true }) {
  const navigate = useNavigate();

  const [countdown, setCountdown] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const lastDetectionTimeRef = useRef(Date.now());
  const initializedRef = useRef(false);
  const currentUserRef = useRef(localStorage.getItem('user_name'));

  // ==========================
  // Convertir base64 -> Blob
  // ==========================
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);

    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
  };

  // ==========================
  // Procesar cada captura
  // ==========================
  const onCapture = async (dataURL) => {
    if (!dataURL || !currentUserRef.current || showModal) return;

    try {
      const blob = dataURLtoBlob(dataURL);
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const res = await api.post('/face/recognize/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const result = res.data;

      // ✅ Usuario presente
      if (result.found && result.user === currentUserRef.current) {
        lastDetectionTimeRef.current = Date.now();
        setCountdown(null); // Ocultar contador
        console.log(`✓ ${result.user} presente`);
        return;
      }

      // ⏱️ Tiempo sin detección
      const elapsed = Date.now() - lastDetectionTimeRef.current;
      const remain = Math.max(0, Math.ceil((10000 - elapsed) / 1000));

      setCountdown(remain);

      if (elapsed >= 10000) {
        console.log('⏱️ Timeout - cerrando sesión');
        setShowModal(true);
        setCountdown(null);
      } else {
        console.log(`⚠️ No detectado (${remain}s restantes)`);
      }

    } catch (err) {
      console.error('Error en checkPresence:', err);
    }
  };

  // ==========================
  // Inicialización
  // ==========================
  useEffect(() => {
    if (!isActive || initializedRef.current) return;

    const user = localStorage.getItem('user_name');
    if (!user) {
      navigate('/');
      return;
    }

    currentUserRef.current = user;
    initializedRef.current = true;
    lastDetectionTimeRef.current = Date.now();

    console.log('👁️ Monitoreo activado para:', user);

    return () => {
      initializedRef.current = false;
    };
  }, [isActive, navigate]);

  // ==========================
  // Logout definitivo
  // ==========================
  const finalizeLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');

    setShowModal(false);
    navigate('/');
  };

  if (!isActive || !currentUserRef.current) return null;

  return (
    <>
      {/* CÁMARA OCULTA */}
      <Camera
        isActive={isActive}
        onCapture={onCapture}
        hidden
      />

     {/* CONTADOR EN PANTALLA */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && !showModal && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-xl font-bold z-[999]"
          >
            ⏱️ Reconectando en {countdown}s
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL FINAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999]"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl text-center space-y-4"
            >
              <div className="text-5xl">⏱️</div>

              <h2 className="text-xl font-bold text-gray-800">
                Sesión cerrada
              </h2>

              <p className="text-gray-600">
                No se detectó tu presencia por más de 10 segundos.
              </p>

              <button
                onClick={finalizeLogout}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition"
              >
                Aceptar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}

export default FaceMonitor;
