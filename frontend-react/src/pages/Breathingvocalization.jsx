import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

function BreathingVocalization() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(null); // 'inhale', 'exhale', 'hold'
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const EXERCISE_DURATION = 300; // 5 minutos en segundos
  const CYCLE_PHASES = [
    { name: 'inhale', duration: 4, instruction: 'Inhalar por 4 segundos', color: 'blue' },
    { name: 'hold', duration: 7, instruction: 'Sostener "oooo"', color: 'purple' },
    { name: 'exhale', duration: 8, instruction: 'Exhalar diciendo "mmm"', color: 'pink' }
  ];

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
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

      // Iniciar temporizador
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => {
          if (prev + 1 >= EXERCISE_DURATION) {
            finishExercise();
            return prev;
          }
          return prev + 1;
        });
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

      phaseTimerRef.current = setInterval(() => {
        phaseTime++;
        if (phaseTime >= phase.duration) {
          phaseIndex = (phaseIndex + 1) % CYCLE_PHASES.length;
          if (phaseIndex === 0) {
            setCyclesCompleted((prev) => prev + 1);
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

  if (showResults && analysisResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100 p-6">
        <div className="max-w-3xl mx-auto">
          
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/exercises/anxiety')}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition mb-4"
            >
              <span className="text-xl">←</span>
              <span>Volver a ejercicios</span>
            </button>

            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              ✅ Ejercicio Completado
            </h1>
            <p className="text-gray-600">
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
              analysisResults.risk_level === 'bajo' ? 'bg-green-50 border-green-300' :
              analysisResults.risk_level === 'moderado' ? 'bg-yellow-50 border-yellow-300' :
              'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">
                  {analysisResults.risk_level === 'bajo' ? '✅' :
                   analysisResults.risk_level === 'moderado' ? '⚠️' : '🔴'}
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

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100 p-6">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/exercises/anxiety')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition mb-4"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-800">
            Respiración con Vocalización
          </h1>
        </div>

        {/* Temporizador circular */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8">
          <div className="flex flex-col items-center">
            
            {/* Círculo de progreso */}
            <div className="relative w-64 h-64 mb-8">
              <svg className="transform -rotate-90 w-64 h-64">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 120}`}
                  strokeDashoffset={`${2 * Math.PI * 120 * (1 - timeElapsed / EXERCISE_DURATION)}`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  {isRecording ? (
                    <>
                      <p className="text-5xl font-bold text-gray-800 mb-2">
                        {formatTime(timeElapsed)}
                      </p>
                      <p className="text-sm text-gray-500">
                        de {formatTime(EXERCISE_DURATION)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xl text-gray-500">segundos</p>
                  )}
                </div>
              </div>
            </div>

            {/* Estado actual */}
            {isRecording && currentPhase && (
              <motion.div
                key={currentPhase.name}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`px-8 py-4 bg-gradient-to-r ${getPhaseColor()} text-white rounded-2xl font-bold text-xl mb-6 shadow-lg`}
              >
                {currentPhase.instruction}
              </motion.div>
            )}

            {/* Stats */}
            {isRecording && (
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{cyclesCompleted}</p>
                  <p className="text-sm text-gray-600">Ciclos</p>
                </div>
                <div className="w-px bg-gray-300"></div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {Math.floor((timeElapsed / EXERCISE_DURATION) * 100)}%
                  </p>
                  <p className="text-sm text-gray-600">Completado</p>
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
                  Presiona Iniciar<br />Cuando estés listo para comenzar
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

        {/* Guía de respiración */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-gray-800 mb-4 text-lg">
            Guía de Respiración
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Inhalar por 4 segundos</p>
                <p className="text-sm text-gray-600">Respira profundamente por la nariz</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold">2</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Exhalar diciendo "mmm"</p>
                <p className="text-sm text-gray-600">Siente la vibración en tu pecho</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-pink-600 font-bold">3</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Sostener "oooo"</p>
                <p className="text-sm text-gray-600">Mantén el sonido lo más prolongado posible</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default BreathingVocalization;