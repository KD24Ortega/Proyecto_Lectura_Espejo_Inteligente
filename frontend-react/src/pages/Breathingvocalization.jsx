import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

// ✅ Reconocimiento (igual que Dashboard/Home)
import FaceMonitor from '../components/FaceMonitor';

// ✅ Hook de theme dinámico
import useDynamicTheme from '../hooks/useDynamicTheme';

function BreathingVocalization() {
  const navigate = useNavigate();

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ✅ THEME dinámico
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg = theme?.colors?.primary || 'from-blue-100 via-purple-100 to-pink-100';

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const EXERCISE_DURATION = 5; // 5 ciclos
  const CYCLE_PHASES = [
    { name: 'inhale', duration: 4, instruction: 'Inhala profundamente', detail: 'Por la nariz', color: 'blue', emoji: '🌬️' },
    { name: 'hold', duration: 7, instruction: 'Sostén el aire', detail: 'Mantén', color: 'purple', emoji: '⏸️' },
    { name: 'exhale', duration: 8, instruction: 'Exhala lentamente', detail: 'Diciendo "aaah"', color: 'pink', emoji: '😮‍💨' }
  ];

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await analyzeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Captura cada segundo
      setIsRecording(true);

      // Iniciar temporizador de tiempo transcurrido
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);

      // Iniciar ciclo de respiración
      startBreathingCycle();

    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      alert('No se pudo acceder al micrófono. Por favor, permite el acceso.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    setIsRecording(false);
  };

  const startBreathingCycle = () => {
    let phaseIndex = 0;
    let phaseTime = 0;

    const runPhase = () => {
      const phase = CYCLE_PHASES[phaseIndex];
      setCurrentPhase(phase);
      phaseTime = 0;
      setPhaseTimeRemaining(phase.duration);

      phaseTimerRef.current = setInterval(() => {
        phaseTime++;
        setPhaseTimeRemaining(phase.duration - phaseTime);

        if (phaseTime >= phase.duration) {
          phaseIndex = (phaseIndex + 1) % CYCLE_PHASES.length;

          // Si completamos un ciclo completo (volvimos a la fase 0)
          if (phaseIndex === 0) {
            setCyclesCompleted((prev) => {
              const newCycleCount = prev + 1;

              // Si completamos 5 ciclos, terminar ejercicio
              if (newCycleCount >= EXERCISE_DURATION) {
                clearInterval(phaseTimerRef.current);
                setTimeout(() => finishExercise(), 500);
              }

              return newCycleCount;
            });
          }

          clearInterval(phaseTimerRef.current);
          runPhase();
        }
      }, 1000);
    };

    runPhase();
  };

  const finishExercise = () => {
    stopRecording();
  };

  const analyzeAudio = async (audioBlob) => {
    setIsAnalyzing(true);

    try {
      const userId = localStorage.getItem('user_id');
      const userGender = localStorage.getItem('user_gender') || 'neutro';

      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'exercise_audio.wav');
      formData.append('user_id', userId);
      formData.append('exercise_id', '1'); // ID del ejercicio en la BD
      formData.append('duration_seconds', timeElapsed);
      formData.append('gender', userGender);
      formData.append('completed', true);

      const response = await api.post('/api/voice/sessions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setAnalysisResults(response.data);
      setShowResults(true);

    } catch (error) {
      console.error('Error al analizar audio:', error);
      alert('Hubo un error al analizar tu voz. Por favor, intenta nuevamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = () => {
    if (!currentPhase) return 'from-gray-400 to-gray-500';
    switch (currentPhase.color) {
      case 'blue': return 'from-blue-400 to-blue-600';
      case 'purple': return 'from-purple-400 to-purple-600';
      case 'pink': return 'from-pink-400 to-pink-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // ✅ LOADING THEME
  if (isThemeLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6 transition-all duration-1000`}>
        <FaceMonitor isActive={true} />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-white drop-shadow-lg">Cargando ejercicio...</p>
        </div>
      </div>
    );
  }

  // ============================
  // RESULTS SCREEN
  // ============================
  if (showResults && analysisResults) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000`}>
        {/* ✅ Reconocimiento */}
        <FaceMonitor isActive={true} />

        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/exercises/anxiety')}
              className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
            >
              <span className="text-xl">←</span>
              <span>Volver a ejercicios</span>
            </button>

            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
              ✅ Ejercicio Completado
            </h1>
            <p className="text-white/90 drop-shadow">
              Duración: {formatTime(timeElapsed)} | Ciclos: {cyclesCompleted}
            </p>
          </div>

          {/* Resultados del análisis */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>Análisis de tu Voz</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">

              {/* Pitch medio */}
              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Tono de voz</p>
                <p className="text-2xl font-bold text-blue-600">
                  {analysisResults.pitch_mean} Hz
                </p>
                <p className="text-xs text-gray-500 mt-1">Variabilidad: {analysisResults.pitch_std}</p>
              </div>

              {/* Energía */}
              <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                <p className="text-sm text-gray-600 mb-1">Energía vocal</p>
                <p className="text-2xl font-bold text-green-600">
                  {(analysisResults.energy * 100).toFixed(1)}%
                </p>
              </div>

              {/* Voice ratio */}
              <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Actividad vocal</p>
                <p className="text-2xl font-bold text-purple-600">
                  {(analysisResults.voice_ratio * 100).toFixed(0)}%
                </p>
              </div>

              {/* HNR */}
              <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
                <p className="text-sm text-gray-600 mb-1">Calidad de voz (HNR)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {analysisResults.hnr.toFixed(1)} dB
                </p>
              </div>

            </div>

            {/* Nivel de riesgo */}
            <div className={`rounded-xl p-6 border-3 ${
              analysisResults.risk_level === 'LOW' ? 'bg-green-50 border-green-300' :
              analysisResults.risk_level === 'MODERATE' ? 'bg-yellow-50 border-yellow-300' :
              'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">
                  {analysisResults.risk_level === 'LOW' ? '✅' :
                   analysisResults.risk_level === 'MODERATE' ? '⚠️' : '🔴'}
                </span>
                <div>
                  <p className="font-bold text-gray-800 text-lg">
                    Nivel de riesgo: {analysisResults.risk_level.charAt(0).toUpperCase() + analysisResults.risk_level.slice(1)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Puntuación: {analysisResults.score.toFixed(1)}/10
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Botones de acción */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              🔄 Repetir ejercicio
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              📊 Ver mi progreso
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ============================
  // ANALYZING SCREEN
  // ============================
  if (isAnalyzing) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center transition-all duration-1000`}>
        {/* ✅ Reconocimiento */}
        <FaceMonitor isActive={!isAnalyzing} />

        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Analizando tu voz...
          </h2>
          <p className="text-gray-600">
            Estamos procesando los biomarcadores vocales de tu ejercicio
          </p>
        </div>
      </div>
    );
  }

  // ============================
  // MAIN SCREEN
  // ============================
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000`}>
      {/* ✅ Reconocimiento */}
      <FaceMonitor isActive={true} />

      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/exercises/anxiety')}
            className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Respiración con Vocalización
          </h1>
        </div>

        {/* Temporizador circular */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8">
          <div className="flex flex-col items-center">

            {/* Círculo de progreso con animación de respiración */}
            <div className="relative w-80 h-80 mb-8">
              {/* Círculo de fondo */}
              <svg className="transform -rotate-90 w-full h-full">
                <circle
                  cx="160"
                  cy="160"
                  r="150"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                {/* Progreso de ciclos */}
                <circle
                  cx="160"
                  cy="160"
                  r="150"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 150}`}
                  strokeDashoffset={`${2 * Math.PI * 150 * (1 - (isRecording ? cyclesCompleted + 1 : cyclesCompleted) / EXERCISE_DURATION)}`}
                  className="transition-all duration-1000"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Círculo interno animado según fase */}
              {isRecording && currentPhase && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{
                    scale: currentPhase.name === 'inhale' ? [1, 1.15, 1.15] :
                           currentPhase.name === 'hold' ? [1.15, 1.15, 1.15] :
                           [1.15, 1, 1]
                  }}
                  transition={{
                    duration: currentPhase.duration,
                    ease: "easeInOut"
                  }}
                >
                  <div className={`w-48 h-48 rounded-full bg-gradient-to-br ${getPhaseColor()} opacity-20 blur-xl`}></div>
                </motion.div>
              )}

              {/* Contenido central */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  {isRecording ? (
                    <>
                      <motion.p
                        className="text-7xl font-bold text-gray-800 mb-2"
                        key={phaseTimeRemaining}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {phaseTimeRemaining}
                      </motion.p>
                      <p className="text-base text-gray-500 font-medium">
                        {cyclesCompleted + 1}/{EXERCISE_DURATION} ciclos
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-7xl font-bold text-gray-300 mb-2">
                        0/5
                      </p>
                      <p className="text-base text-gray-400 font-medium">ciclos</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Instrucción actual con animación mejorada */}
            {isRecording && currentPhase && (
              <motion.div
                key={currentPhase.name}
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className={`relative px-10 py-6 bg-gradient-to-r ${getPhaseColor()} text-white rounded-3xl font-bold text-2xl mb-6 shadow-2xl overflow-hidden`}
              >
                {/* Efecto de brillo */}
                <div className="absolute inset-0 bg-white opacity-10 blur-2xl"></div>

                <div className="relative flex items-center justify-center gap-4">
                  <span className="text-4xl">{currentPhase.emoji}</span>
                  <div>
                    <p className="leading-tight">{currentPhase.instruction}</p>
                    <p className="text-base font-normal opacity-90 mt-1">{currentPhase.detail}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Stats */}
            {isRecording && (
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{cyclesCompleted + 1}/5</p>
                  <p className="text-sm text-gray-600">Ciclo actual</p>
                </div>
                <div className="w-px bg-gray-300"></div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatTime(timeElapsed)}
                  </p>
                  <p className="text-sm text-gray-600">Tiempo</p>
                </div>
              </div>
            )}

            {/* Botón de inicio */}
            {!isRecording && (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <p className="text-gray-600 mb-6">
                  Presiona Iniciar para comenzar<br />
                  <span className="text-sm">(5 ciclos de respiración guiada)</span>
                </p>
                <button
                  onClick={startRecording}
                  className="px-12 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition flex items-center gap-3 mx-auto"
                >
                  <span className="text-2xl">▶</span>
                  <span>Iniciar</span>
                </button>
              </motion.div>
            )}

            {/* Botón de detener */}
            {isRecording && (
              <button
                onClick={finishExercise}
                className="mt-6 px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition"
              >
                ⏹ Detener ejercicio
              </button>
            )}

          </div>
        </div>

        {/* Guía de respiración mejorada */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🧘</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">
                Técnica de Respiración 4-7-8
              </h3>
              <p className="text-sm text-gray-500">Creada por el Dr. Andrew Weil</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">4</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>🌬️</span> Inhala por la nariz
                </p>
                <p className="text-sm text-gray-600 mt-1">Cuenta mentalmente hasta 4. Siente cómo el aire llena tus pulmones completamente</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">7</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>⏸️</span> Sostén el aire
                </p>
                <p className="text-sm text-gray-600 mt-1">Mantén la respiración durante 7 segundos. Relaja los hombros y el abdomen</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-pink-50 rounded-xl border-2 border-pink-200">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">8</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>😮‍💨</span> Exhala completamente
                </p>
                <p className="text-sm text-gray-600 mt-1">Exhala haciendo un sonido "aaah" audible. Libera toda la tensión</p>
              </div>
            </div>
          </div>

          <div className="mt-5 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Beneficios comprobados:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Reduce la ansiedad y el estrés en minutos</li>
                  <li>• Activa el sistema nervioso parasimpático</li>
                  <li>• Mejora la calidad del sueño</li>
                  <li>• Aumenta la concentración y claridad mental</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default BreathingVocalization;
