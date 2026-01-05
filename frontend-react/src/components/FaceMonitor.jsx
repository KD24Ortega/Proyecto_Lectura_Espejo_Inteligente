import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { API_BASE_URL } from '../services/api';
import Camera from './Camera';

function FaceMonitor({ isActive = true }) {
  const navigate = useNavigate();

  // ==========================
  // Configuración
  // ==========================
  const TIMEOUT_MS = 15000;           // ✅ 15s
  const CAPTURE_EVERY_MS = 900;       // frames llegan frecuente, pero requests NO (ver inFlight)
  const REQUEST_TIMEOUT_MS = 8000;    // ✅ sube timeout (tu backend a veces tarda > 3.5s)
  const MAX_INFLIGHT_MS = 9000;       // ✅ watchdog: si se pega, abort

  const [countdown, setCountdown] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const initializedRef = useRef(false);
  const currentUserRef = useRef(localStorage.getItem('user_name'));
  const currentUserIdRef = useRef(localStorage.getItem('user_id'));

  const showModalRef = useRef(false);
  const isActiveRef = useRef(isActive);

  useEffect(() => { showModalRef.current = showModal; }, [showModal]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Para throttle y control
  const lastSentRef = useRef(0);

  // Anti respuestas viejas
  const requestIdRef = useRef(0);

  // ✅ Control de request en vuelo
  const inFlightRef = useRef(false);
  const inFlightSinceRef = useRef(0);
  const abortRef = useRef(null);

  // ==========================
  // Countdown estable
  // ==========================
  const deadlineRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastSecRef = useRef(null);

  const openModal = useCallback(() => {
    showModalRef.current = true;
    setShowModal(true);
  }, []);

  const endSessionSentRef = useRef(false);

  const endSessionInBackground = useCallback((reason = '') => {
    if (endSessionSentRef.current) return;

    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    endSessionSentRef.current = true;

    const payload = JSON.stringify({ user_id: parseInt(userId) });
    const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
    const apiUrl = API_BASE_URL;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(`${apiUrl}/session/end`, blob);
      } else {
        fetch(`${apiUrl}/session/end`, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          keepalive: true,
        }).catch(() => {});
      }
      console.log(`🚪 FaceMonitor: sesión marcada como cerrada (${reason})`);
    } catch {
      // best-effort
    }
  }, []);

  const clearCountdown = useCallback(() => {
    deadlineRef.current = null;
    lastSecRef.current = null;
    setCountdown(null);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdownIfNeeded = useCallback((reason = '') => {
    if (showModalRef.current) return;     // ✅ si ya está cerrando, no reinicies
    if (deadlineRef.current) return;      // ✅ ya corriendo

    deadlineRef.current = Date.now() + TIMEOUT_MS;
    console.log(`⏱️ FaceMonitor: countdown iniciado (15s). ${reason}`);

    const tick = () => {
      if (showModalRef.current) {
        clearCountdown();
        return;
      }

      const remainMs = deadlineRef.current - Date.now();
      const remainSec = Math.max(0, Math.ceil(remainMs / 1000));

      if (lastSecRef.current !== remainSec) {
        lastSecRef.current = remainSec;
        setCountdown(remainSec);

        if (remainSec === 15 || remainSec === 10 || remainSec === 5 || remainSec <= 3) {
          console.log(`⏳ FaceMonitor: quedan ${remainSec}s`);
        }
      }

      if (remainMs <= 0) {
        clearCountdown();
        console.log('🛑 FaceMonitor: timeout alcanzado -> cerrando sesión');
        endSessionInBackground('timeout ausencia 15s');
        openModal();
      }
    };

    tick();
    countdownIntervalRef.current = setInterval(tick, 200);
  }, [clearCountdown, openModal, endSessionInBackground]);

  // ==========================
  // Convertir base64 -> Blob
  // ==========================
  const dataURLtoBlob = (dataURL) => {
    if (typeof dataURL !== 'string') return null;

    const arr = dataURL.split(',');
    if (arr.length < 2) return null;

    // Ejemplo esperado: data:image/jpeg;base64,xxxx
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) return null;
    const mime = mimeMatch[1];

    // Si es algo como "data:," o no tiene payload base64
    if (!arr[1]) return null;

    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  };

  // ==========================
  // Debug: frame recibido
  // ==========================
  const lastFrameLogRef = useRef(0);

  // ==========================
  // Worker
  // ==========================
  const onCaptureWorker = async (dataURL) => {
    if (!isActiveRef.current || !dataURL || showModalRef.current) return;

    const now = Date.now();
    if (now - lastFrameLogRef.current > 1000) {
      lastFrameLogRef.current = now;
      console.log('🎥 FaceMonitor: frame recibido');
    }

    // Throttle de entrada (no de requests)
    if (now - lastSentRef.current < CAPTURE_EVERY_MS) return;
    lastSentRef.current = now;

    // ✅ Si hay request en vuelo, NO mandes otra (evita saturar backend)
    if (inFlightRef.current) {
      const stuckFor = Date.now() - inFlightSinceRef.current;
      if (stuckFor > MAX_INFLIGHT_MS) {
        console.log(`⚠️ FaceMonitor: request pegada (${stuckFor}ms) -> abortando`);
        try { abortRef.current?.abort(); } catch {}
        inFlightRef.current = false;
        abortRef.current = null;
        requestIdRef.current++; // invalida respuesta tardía
      } else {
        console.log('⏸️ FaceMonitor: request en vuelo, esperando...');
        return;
      }
    }

    const userNow = localStorage.getItem('user_name');
    const userIdNow = localStorage.getItem('user_id');
    if (!userNow) {
      console.log('⚠️ FaceMonitor: no hay user_name -> /');
      navigate('/');
      return;
    }

    if (!userIdNow) {
      console.log('⚠️ FaceMonitor: no hay user_id -> /');
      navigate('/');
      return;
    }

    if (currentUserRef.current !== userNow) {
      console.log(`🔄 FaceMonitor: user cambió ${currentUserRef.current} -> ${userNow}`);
      currentUserRef.current = userNow;
      currentUserIdRef.current = userIdNow;
      clearCountdown();
      requestIdRef.current++; // invalida respuestas viejas
    }

    if (currentUserIdRef.current !== userIdNow) {
      currentUserIdRef.current = userIdNow;
      clearCountdown();
      requestIdRef.current++;
    }

    // Preparar request
    const myRequestId = ++requestIdRef.current;
    const t0 = performance.now();

    const controller = new AbortController();
    abortRef.current = controller;

    inFlightRef.current = true;
    inFlightSinceRef.current = Date.now();

    try {
      const blob = dataURLtoBlob(dataURL);
      if (!blob) {
        // Frame inválido / video aún no listo: no cuenta como ausencia
        return;
      }
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('expected_user_id', String(userIdNow));

      console.log(`📸 FaceMonitor: enviando checkPresence (req=${myRequestId})`);

      const res = await api.post('/face/recognize/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: REQUEST_TIMEOUT_MS,
        signal: controller.signal,
      });

      const dt = Math.round(performance.now() - t0);

      // Ignorar respuesta vieja
      if (myRequestId !== requestIdRef.current) {
        console.log(`🕒 FaceMonitor: respuesta vieja ignorada (req=${myRequestId}, ${dt}ms)`);
        return;
      }

      const result = res.data;
      const expectedUserId = Number(userIdNow);

      if (result?.found && Number(result?.user_id) === expectedUserId) {
        console.log(`✅ FaceMonitor: presente -> user_id=${result.user_id} (${dt}ms)`);
        clearCountdown();
        return;
      }

      console.log(`⚠️ FaceMonitor: usuario no detectado (${dt}ms)`);
      startCountdownIfNeeded('Motivo: no detectado');

    } catch (err) {
      // ✅ Si fue abort, NO lo trates como ausencia (evita countdown falso)
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        console.log('🧯 FaceMonitor: request cancelada (abort) -> no cuenta como ausencia');
        return;
      }

      console.log('❌ FaceMonitor: error/timeout en checkPresence');
      // Importante: bajo carga (varios usuarios) el backend puede tardar y provocar timeouts.
      // No tratamos estos errores transitorios como ausencia para evitar cierres de sesión falsos.
      console.error('Error en checkPresence:', err);

    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
    }
  };

  // ✅ callback estable para Camera
  const onCaptureRef = useRef(onCaptureWorker);
  useEffect(() => { onCaptureRef.current = onCaptureWorker; });
  const onCaptureStable = useCallback((dataURL) => onCaptureRef.current(dataURL), []);

  // ==========================
  // Inicialización
  // ==========================
  useEffect(() => {
    if (!isActive || initializedRef.current) return;

    const user = localStorage.getItem('user_name');
    const userId = localStorage.getItem('user_id');
    if (!user) {
      console.log('⚠️ FaceMonitor: no hay sesión -> /');
      navigate('/');
      return;
    }

    if (!userId) {
      console.log('⚠️ FaceMonitor: no hay sesión (user_id) -> /');
      navigate('/');
      return;
    }

    currentUserRef.current = user;
    currentUserIdRef.current = userId;
    initializedRef.current = true;
    clearCountdown();
    endSessionSentRef.current = false;

    console.log('👁️ FaceMonitor: monitoreo activado para:', user);

    return () => {
      initializedRef.current = false;
      clearCountdown();
      endSessionSentRef.current = false;
      try { abortRef.current?.abort(); } catch {}
      console.log('🧹 FaceMonitor: desmontado -> limpiando');
    };
  }, [isActive, navigate, clearCountdown]);

  // ==========================
  // Logout definitivo
  // ==========================
  const finalizeLogout = () => {
    console.log('🚪 FaceMonitor: cerrando sesión y limpiando localStorage');
    try { abortRef.current?.abort(); } catch {}

    // Asegura que el backend también quede como inactivo (por si no se envió antes)
    endSessionInBackground('logout UI');

    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');

    clearCountdown();
    setShowModal(false);
    showModalRef.current = false;
    navigate('/');
  };

  if (!isActive || !currentUserRef.current) return null;

  return (
    <>
      {/* ✅ Importante: cuando showModal está activo, apaga Camera */}
      <Camera isActive={isActive && !showModal} onCapture={onCaptureStable} hidden />

      <AnimatePresence>
        {countdown !== null && countdown > 0 && !showModal && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-elevated font-bold z-[999]"
          >
            ⏱️ Verificando presencia... {countdown}s
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-white max-w-md w-full p-6 rounded-ui-xl shadow-modal text-center space-y-4"
            >
              <div className="text-5xl">⏱️</div>
              <h2 className="text-xl font-bold text-gray-800">Sesión cerrada</h2>
              <p className="text-gray-600">
                No se detectó tu presencia por más de 15 segundos.
              </p>
              <button
                onClick={finalizeLogout}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-ui-sm font-bold transition"
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
