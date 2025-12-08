import { useState, useEffect } from 'react';
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
const Robot = ({ isVisible, userName, navigate }) => (
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
          <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse shadow-md shadow-cyan-500/50"></div>
          <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse shadow-md shadow-cyan-500/50"></div>
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
        <>
          <p className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            ✅ ¡Bienvenido, {userName}!
          </p>
          <p className="text-gray-600 mt-2">
            Redirigiendo a tu dashboard…
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold text-gray-800 mb-6">
            Colócate frente a la cámara
          </p>

          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-semibold shadow-lg hover:scale-105 transition-all duration-300"
          >
            ✨ ¿Primera vez? Regístrate aquí
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
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

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

  // ---------------- RECONOCIMIENTO FACIAL ----------------
  const handleCapture = async (frameBase64) => {
    if (isRecognizing || step < 4 || userName) return;

    setIsRecognizing(true);

    try {
      const base64Data = frameBase64.split(',')[1];
      const binaryData = atob(base64Data);

      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([array], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const response = await api.post('/face/recognize/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { found, user } = response.data;

      if (found && user) {
        // ✅ NUEVO: Obtener user_id desde el backend
        try {
          const userResponse = await api.get(`/user/id-by-name?name=${encodeURIComponent(user)}`);
          const userId = userResponse.data.user_id;
          
          // ✅ NUEVO: Guardar user_id Y nombre
          localStorage.setItem('user_id', userId);
          localStorage.setItem('user_name', user);
          localStorage.setItem('last_recognition', new Date().toISOString());
          
          setUserName(user);

          // Iniciar sesión en DB (opcional)
          await api.post('/session/start', { username: user });

          setTimeout(() => navigate('/home'), 1000);
          
        } catch (error) {
          console.error('Error al obtener user_id:', error);
          alert('Error: Usuario no encontrado en la base de datos');
        }
      }
      else if (found && !user) {
        setTimeout(() => navigate('/register'), 1500);
      }

    } catch (error) {
      console.error('Error en reconocimiento:', error);
    } finally {
      setIsRecognizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col items-center justify-between px-4 sm:px-10 py-10 overflow-hidden">

      <button
        onClick={() => navigate('/admin/login')}
        className="fixed top-4 right-4 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-110"
        title="Panel Administrativo"
      >
        🛡️
      </button>

      {/* CAMARA */}
      <div className="hidden">
        <Camera
          onCapture={handleCapture}
          isActive={step >= 4 && !userName}
        />
      </div>

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-16"
      >
        <h1 className="text-[56px] text-[#1a1a1a] mb-4">
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
          className="mb-10"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Robot
              isVisible={true}
              userName={userName}
              navigate={navigate}
            />
          </motion.div>
        </motion.div>
      )}

    </div>
  );
}