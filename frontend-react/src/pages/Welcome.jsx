import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Camera from '../components/Camera';
import api from '../services/api';

// -------------------------------------
// MENSAJES ROTATIVOS
// -------------------------------------
const statusMessages = [
  "Solo un segundo, nos estamos preparando...",
  "Activando sensores de reconocimiento...",
  "Configurando tu espacio personal...",
  "Cargando módulos de evaluación...",
  "Casi listo para recibirte...",
  "Preparando tu panel personalizado..."
];

// -------------------------------------
// ROBOT
// -------------------------------------
const Robot = ({ isVisible, userName, isNewUser, navigate }) => (
  <div
    className={`flex flex-col items-center transition-all duration-700
      ${isVisible
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 translate-y-12 pointer-events-none'
      }
    `}
  >
    {/* Robot */}
    <div className="robot-icon w-32 h-32 relative scale-125">
      <div className="w-20 h-20 bg-white rounded-lg absolute top-0 left-1/2 -translate-x-1/2 shadow-xl border-4 border-gray-100/50">
        <div className="flex space-x-2 justify-center mt-3">
          <div className={`w-4 h-4 rounded-full animate-pulse shadow-md ${
            userName ? 'bg-green-400 shadow-green-500/50' : 
            isNewUser ? 'bg-yellow-400 shadow-yellow-500/50' :
            'bg-cyan-400 shadow-cyan-500/50'
          }`}></div>
          <div className={`w-4 h-4 rounded-full animate-pulse shadow-md ${
            userName ? 'bg-green-400 shadow-green-500/50' : 
            isNewUser ? 'bg-yellow-400 shadow-yellow-500/50' :
            'bg-cyan-400 shadow-cyan-500/50'
          }`}></div>
        </div>
        <div className="w-8 h-2 bg-gray-700 rounded-b-full absolute bottom-2 left-1/2 -translate-x-1/2"></div>
      </div>

      <div className="w-16 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-t-full absolute bottom-0 left-1/2 -translate-x-1/2 shadow-lg">
        <div className="w-full h-5 bg-white rounded-t-full absolute bottom-0 opacity-70"></div>
      </div>

      <div className="w-5 h-10 bg-gray-700 rounded-full absolute top-8 -left-5 rotate-[-12deg] animate-robot-wave">
        <div className="w-4 h-4 bg-white rounded-full absolute bottom-0 left-0" />
      </div>

      <div className="w-5 h-10 bg-gray-700 rounded-full absolute top-8 -right-5 rotate-[12deg] animate-robot-wave delay-150">
        <div className="w-4 h-4 bg-white rounded-full absolute bottom-0 right-0" />
      </div>
    </div>

    {/* Mensajes */}
    <div className="mt-10 text-center">
      {userName ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent mb-2">
            ✅ ¡Bienvenido de nuevo, {userName}!
          </p>
          <p className="text-gray-600">
            Redirigiendo a tu dashboard…
          </p>
        </motion.div>
      ) : isNewUser ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
            👋 ¡Hola! Parece que eres nuevo
          </p>
          <p className="text-gray-600 mb-4">
            Vamos a registrarte en el sistema…
          </p>
        </motion.div>
      ) : (
        <>
          <p className="text-2xl font-semibold text-gray-800 mb-4">
            Colócate frente a la cámara
          </p>
          <p className="text-gray-600 mb-6">
            El reconocimiento facial se activará automáticamente
          </p>

          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-semibold shadow-lg hover:scale-105 transition-all duration-300"
          >
            ✨ ¿Primera vez? Regístrate manualmente
          </button>
        </>
      )}
    </div>
  </div>
);

// -------------------------------------
// WELCOME PRINCIPAL
// -------------------------------------
export default function Welcome() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [userName, setUserName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [error, setError] = useState("");
  
  const recognitionAttempts = useRef(0);
  const maxAttempts = 30;
  
  // ============================================================
  // NUEVO: Referencias para cleanup
  // ============================================================
  const isComponentMounted = useRef(true);
  const abortControllerRef = useRef(null);

  // ============================================================
  // CORREGIDO: Cleanup al montar/desmontar
  // ============================================================
  useEffect(() => {
    // Marcar componente como montado
    isComponentMounted.current = true;
    
    // Limpiar sesión anterior al entrar a Welcome
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');
    
    console.log('🔄 Welcome: Sesión anterior limpiada');

    // CLEANUP al desmontar componente
    return () => {
      console.log('🧹 Welcome: Componente desmontado - limpiando...');
      isComponentMounted.current = false;
      
      // Cancelar cualquier request pendiente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        console.log('🛑 Request de reconocimiento cancelado');
      }
      
      // Limpiar estados
      setIsRecognizing(false);
      recognitionAttempts.current = 0;
    };
  }, []);

  // ---------------- PASOS ----------------
  useEffect(() => {
    const t1 = setTimeout(() => setStep(2), 1500);
    const t2 = setTimeout(() => setStep(3), 3000);
    const t3 = setTimeout(() => setStep(4), 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // ---------------- MENSAJES ----------------
  useEffect(() => {
    if (step < 3) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex(
        prev => (prev + 1) % statusMessages.length
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [step]);

  // ============================================================
  // CORREGIDO: Reconocimiento facial con cleanup y timeout aumentado
  // ============================================================
  const handleCapture = async (frameBase64) => {
    // NUEVO: Verificar si el componente está montado
    if (!isComponentMounted.current) {
      console.log('🛑 Componente desmontado - ignorando captura');
      return;
    }

    // Validaciones
    if (isRecognizing || step < 4 || userName || isNewUser) return;
    
    // Límite de intentos
    if (recognitionAttempts.current >= maxAttempts) {
      if (!error) {
        setError('No se pudo detectar tu rostro. Por favor, regístrate manualmente.');
      }
      return;
    }

    setIsRecognizing(true);
    recognitionAttempts.current += 1;

    // NUEVO: Crear AbortController para esta petición
    abortControllerRef.current = new AbortController();

    try {
      // Convertir base64 a blob
      const base64Data = frameBase64.split(',')[1];
      const binaryData = atob(base64Data);

      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([array], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      console.log(`🔍 Intento de reconocimiento ${recognitionAttempts.current}/${maxAttempts}`);

      // CORREGIDO: Timeout aumentado de 5s a 15s y signal para cancelación
      const response = await api.post('/face/recognize/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15000, // ✅ 15 segundos (antes: 5000)
        signal: abortControllerRef.current.signal // ✅ Permitir cancelación
      });

      // NUEVO: Verificar si aún está montado antes de procesar
      if (!isComponentMounted.current) {
        console.log('🛑 Componente desmontado después de request - ignorando respuesta');
        return;
      }

      const { found, user } = response.data;

      // ✅ CASO 1: Usuario reconocido (found=true, user=nombre)
      if (found && user) {
        console.log('✅ Usuario reconocido:', user);
        
        try {
          // Obtener user_id desde el backend
          const userResponse = await api.get(`/user/id-by-name?name=${encodeURIComponent(user)}`, {
            signal: abortControllerRef.current.signal
          });
          const userId = userResponse.data.user_id;
          
          console.log('✅ User ID obtenido:', userId);
          
          // NUEVO: Verificar montaje antes de continuar
          if (!isComponentMounted.current) return;
          
          // Guardar en localStorage
          localStorage.setItem('user_id', userId.toString());
          localStorage.setItem('user_name', user);
          localStorage.setItem('last_recognition', new Date().toISOString());
          
          setUserName(user);

          // Iniciar sesión en DB
          try {
            await api.post('/session/start', { 
              user_id: userId,
              username: user 
            }, {
              signal: abortControllerRef.current.signal
            });
            console.log('✅ Sesión iniciada en DB');
          } catch (sessionError) {
            // Ignorar si fue cancelado
            if (sessionError.name === 'AbortError' || sessionError.name === 'CanceledError') {
              console.log('🛑 Inicio de sesión cancelado');
              return;
            }
            console.warn('⚠️ Error al iniciar sesión en DB:', sessionError);
          }

          // NUEVO: Verificar montaje antes de redirigir
          if (!isComponentMounted.current) return;

          // Redirigir después de 1.5 segundos
          setTimeout(() => {
            if (isComponentMounted.current) {
              console.log('🚀 Redirigiendo a /home');
              navigate('/home');
            }
          }, 1500);
          
        } catch (userIdError) {
          // NUEVO: Ignorar si fue cancelado
          if (userIdError.name === 'AbortError' || userIdError.name === 'CanceledError') {
            console.log('🛑 Obtención de user_id cancelada');
            return;
          }

          console.error('❌ Error al obtener user_id:', userIdError);
          
          // NUEVO: Solo actualizar estado si está montado
          if (isComponentMounted.current) {
            setError('Error al cargar tu perfil. Intenta nuevamente.');
            
            // Limpiar y permitir reintentar
            setTimeout(() => {
              if (isComponentMounted.current) {
                setUserName('');
                setError('');
                recognitionAttempts.current = 0;
              }
            }, 3000);
          }
        }
      }
      // ⚠️ CASO 2: Rostro detectado pero no registrado (found=true, user=null/undefined)
      else if (found && !user) {
        console.log('⚠️ Rostro detectado pero no registrado');
        
        // NUEVO: Verificar montaje
        if (isComponentMounted.current) {
          setIsNewUser(true);

          // Redirigir a registro después de 1.5 segundos
          setTimeout(() => {
            if (isComponentMounted.current) {
              console.log('🚀 Redirigiendo a /register (usuario nuevo)');
              navigate('/register');
            }
          }, 1500);
        }
      }
      // ⏸️ CASO 3: No se detectó rostro (found=false)
      else {
        console.log('⏸️ No se detectó rostro, reintentando...');
      }

    } catch (error) {
      // NUEVO: Ignorar errores de cancelación
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        console.log('🛑 Request cancelado (componente desmontado)');
        return;
      }

      console.error('❌ Error en reconocimiento:', error);
      
      // NUEVO: Solo actualizar estado si el componente está montado
      if (isComponentMounted.current) {
        // No mostrar error en cada intento fallido, solo al límite
        if (recognitionAttempts.current >= maxAttempts) {
          setError('Error de conexión con el servidor. Intenta registrarte manualmente.');
        }
      }
    } finally {
      // NUEVO: Solo actualizar estado si está montado
      if (isComponentMounted.current) {
        setIsRecognizing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col items-center justify-between px-4 sm:px-10 py-10 overflow-hidden">

      {/* Botón Admin */}
      <button
        onClick={() => navigate('/admin/login')}
        className="fixed top-6 right-6 z-50 group"
        title="Panel Administrativo"
      >
        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-full shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center">
          <span className="text-2xl group-hover:rotate-12 transition-transform duration-300">🛡️</span>
        </div>
        
        {/* Tooltip mejorado */}
        <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Panel Administrativo
        </div>
      </button>

      {/* CAMARA (oculta pero activa) - CORREGIDO: Solo activa si está montado */}
      <div className="hidden">
        {isComponentMounted.current && (
          <Camera
            onCapture={handleCapture}
            isActive={step >= 4 && !userName && !isNewUser}
          />
        )}
      </div>

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-16"
      >
        <h1 className="text-[56px] text-[#1a1a1a] mb-4 font-bold">
          ¡Bienvenido!
        </h1>
        <p className="text-[28px] text-[#4a5568]">
          Soy tu asistente de bienestar
        </p>
      </motion.div>

      {/* SPINNER + MENSAJES */}
      {(step === 2 || step === 3) && (
        <motion.div
          initial={{ opacity: 0, scale: .9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-grow flex flex-col items-center justify-center"
        >
          <div className="relative mb-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              className="w-[140px] h-[140px] border-[7px] border-transparent border-t-blue-500 border-r-blue-500 border-b-blue-500 rounded-full"
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-blue-500 text-lg font-medium">
                Cargando
              </span>
            </div>
          </div>

          <div className="h-[60px] flex items-center justify-center max-w-[600px]">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-[18px] text-[#718096] text-center px-8"
              >
                {statusMessages[currentMessageIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ROBOT */}
      {step >= 4 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-grow flex items-center justify-center mb-10"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Robot
              isVisible={true}
              userName={userName}
              isNewUser={isNewUser}
              navigate={navigate}
            />
          </motion.div>
        </motion.div>
      )}

      {/* Mensaje de error */}
      {error && step >= 4 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-lg max-w-md"
        >
          <p className="text-red-700 text-center font-medium">{error}</p>
          <button
            onClick={() => navigate('/register')}
            className="mt-3 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
          >
            Ir a registro manual
          </button>
        </motion.div>
      )}

      {/* Indicador de intentos (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && step >= 4 && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-xs">
          Intentos: {recognitionAttempts.current}/{maxAttempts}
        </div>
      )}

    </div>
  );
}