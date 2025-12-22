import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

// ✅ Reconocimiento
import FaceMonitor from "../components/FaceMonitor";

// ✅ Hook de theme dinámico
import useDynamicTheme from "../hooks/useDynamicTheme";

function VocalAffirmations() {
  const navigate = useNavigate();

  const AFFIRMATIONS = [
    "Soy capaz de manejar esto",
    "Merezco ser feliz",
    "Cada día mejoro un poco más",
    "Soy fuerte y valiente",
    "Puedo superar cualquier obstáculo",
    "Mi valor no depende de los demás",
    "Estoy en el camino correcto",
    "Confío en mis capacidades",
  ];

  const [index, setIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [phrasesRead, setPhrasesRead] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const autoTimerRef = useRef(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // ✅ THEME dinámico (igual que GuidedDialogue)
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg = theme?.colors?.primary || "from-teal-100 via-cyan-100 to-blue-100";

  // AUTO ROTACIÓN
  useEffect(() => {
    if (autoPlay && isRecording && index < AFFIRMATIONS.length - 1) {
      autoTimerRef.current = setTimeout(() => {
        setIndex((prev) => prev + 1);
        setPhrasesRead((prev) => prev + 1);
      }, 8000);
    }
    return () => clearTimeout(autoTimerRef.current);
  }, [autoPlay, index, isRecording]);

  // Marcar primera frase como leída al iniciar
  useEffect(() => {
    if (isRecording && index === 0 && phrasesRead === 0) {
      setPhrasesRead(1);
    }
  }, [isRecording, index, phrasesRead]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(autoTimerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────
  // INICIAR GRABACIÓN
  // ─────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setIsRecording(true);
      setAutoPlay(true);
      setTimeElapsed(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        await sendAudio(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000);

      timerRef.current = setInterval(() => {
        setTimeElapsed((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      alert("No se pudo acceder al micrófono. Por favor, permite el acceso.");
    }
  };

  // ─────────────────────────────────────────────
  // DETENER GRABACIÓN (FINALIZAR)
  // ─────────────────────────────────────────────
  const finishReading = () => {
    clearInterval(timerRef.current);
    clearTimeout(autoTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Avance manual
  const handleNext = () => {
    if (index < AFFIRMATIONS.length - 1) {
      setIndex((prev) => prev + 1);
      setPhrasesRead((prev) => prev + 1);
    }
  };

  // ─────────────────────────────────────────────
  // ENVIAR AL BACKEND
  // ─────────────────────────────────────────────
  const sendAudio = async (audioBlob) => {
    setIsAnalyzing(true);

    try {
      const userId = localStorage.getItem("user_id");
      const gender = localStorage.getItem("user_gender") || "neutro";

      const fd = new FormData();
      fd.append("audio_file", audioBlob, "affirmations.wav");
      fd.append("user_id", userId);
      fd.append("exercise_id", "5");
      fd.append("duration_seconds", timeElapsed);
      fd.append("gender", gender);
      fd.append("completed", true);

      const response = await api.post("/api/voice/sessions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setAnalysisResults(response.data);
      setShowResults(true);
    } catch (error) {
      console.error("Error al procesar afirmaciones:", error);
      alert("Error al procesar tus afirmaciones. Por favor, intenta nuevamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent =
    ((index + (isRecording ? 1 : 0)) / AFFIRMATIONS.length) * 100;

  // ─────────────────────────────────────────────
  // ✅ LOADING THEME (evita el fondo “tarde”)
  // ─────────────────────────────────────────────
  if (isThemeLoading) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6 transition-all duration-1000`}
      >
        <FaceMonitor isActive={true} />

        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-white drop-shadow-lg">
            Cargando ejercicio...
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  PANTALLA CARGANDO (ANALIZANDO)
  // ─────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6 transition-all duration-1000`}
      >
        <FaceMonitor isActive={!isAnalyzing} />

        <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md">
          <div className="w-20 h-20 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Analizando tu voz…
          </h2>
          <p className="text-gray-600">Procesando tu afirmación vocal</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  PANTALLA DE RESULTADOS
  // ─────────────────────────────────────────────
  if (showResults && analysisResults) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000`}>
        <FaceMonitor isActive={true} />

        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate("/exercises/depression")}
              className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
            >
              <span className="text-xl">←</span>
              <span>Volver a ejercicios</span>
            </button>

            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
              ✅ Ejercicio Completado
            </h1>
            <p className="text-white/90 drop-shadow">
              Duración: {formatTime(timeElapsed)} | Afirmaciones leídas: {phrasesRead}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>Análisis de tu Voz</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-teal-50 rounded-xl p-4 border-2 border-teal-200">
                <p className="text-sm text-gray-600 mb-1">Tono de voz</p>
                <p className="text-2xl font-bold text-teal-600">
                  {analysisResults.pitch_mean} Hz
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Variabilidad: {analysisResults.pitch_std}
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                <p className="text-sm text-gray-600 mb-1">Energía vocal</p>
                <p className="text-2xl font-bold text-green-600">
                  {(analysisResults.energy * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Actividad vocal</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(analysisResults.voice_ratio * 100).toFixed(0)}%
                </p>
              </div>

              <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
                <p className="text-sm text-gray-600 mb-1">Calidad de voz (HNR)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {analysisResults.hnr.toFixed(1)} dB
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl p-6 border-3 ${
                analysisResults.risk_level === "LOW"
                  ? "bg-green-50 border-green-300"
                  : analysisResults.risk_level === "MODERATE"
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-red-50 border-red-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">
                  {analysisResults.risk_level === "LOW"
                    ? "✅"
                    : analysisResults.risk_level === "MODERATE"
                    ? "⚠️"
                    : "🔴"}
                </span>
                <div>
                  <p className="font-bold text-gray-800 text-lg">
                    Estado emocional detectado
                  </p>
                  <p className="text-sm text-gray-600">
                    Puntuación: {analysisResults.score.toFixed(1)}/10
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              🔄 Repetir ejercicio
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              📊 Ver mi progreso
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // PÁGINA PRINCIPAL
  // ─────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000`}>
      <FaceMonitor isActive={true} />

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate("/exercises/depression")}
            className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-teal-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">💬</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Afirmación Vocal Dirigida
                </h1>
                <p className="text-gray-600 mt-1">
                  Fortalece tu autoestima con afirmaciones positivas
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg mb-8 border-2 border-teal-100">
          <div className="flex justify-between items-center mb-3">
            <p className="font-semibold text-gray-700">
              {isRecording ? "Lectura en progreso" : "Progreso de Afirmaciones"}
            </p>
            <p className="text-2xl font-bold text-teal-600">
              {index + (isRecording ? 1 : 0)}/{AFFIRMATIONS.length}
            </p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-4 rounded-full bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500"
            />
          </div>

          {isRecording && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              ¡Vas muy bien! Continúa leyendo las afirmaciones
            </p>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8 border-2 border-teal-50">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-gray-500">Afirmación actual</span>
            <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-5 py-2 rounded-xl font-bold text-sm">
              {index + 1} / {AFFIRMATIONS.length}
            </span>
          </div>

          <div className="min-h-[160px] flex items-center justify-center mb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <span className="absolute -top-6 -left-8 text-8xl text-teal-200 font-serif opacity-50">
                  "
                </span>

                <p className="text-center text-3xl md:text-4xl font-bold text-gray-800 leading-relaxed px-12">
                  {AFFIRMATIONS[index]}
                </p>

                <span className="absolute -bottom-10 -right-8 text-8xl text-teal-200 font-serif opacity-50">
                  "
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center items-center gap-6 mb-6"
            >
              <div>
                <p className="text-3xl font-bold text-teal-600">
                  {phrasesRead}/{AFFIRMATIONS.length}
                </p>
                <p className="text-sm text-gray-600 text-center">Afirmaciones</p>
              </div>

              <div className="w-px h-12 bg-gray-300"></div>

              <div>
                <p className="text-3xl font-bold text-blue-600">
                  {formatTime(timeElapsed)}
                </p>
                <p className="text-sm text-gray-600 text-center">Tiempo</p>
              </div>

              <div className="w-px h-12 bg-gray-300"></div>

              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-gray-700">
                  Grabando
                </span>
              </div>
            </motion.div>
          )}

          {/* ✅ Controles SOLO cuando está grabando (sin banco de afirmaciones) */}
          {isRecording && (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className={`px-8 py-3 rounded-xl font-semibold transition ${
                  index === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg"
                }`}
              >
                ← Anterior
              </button>

              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`px-8 py-3 rounded-xl font-semibold transition ${
                  autoPlay
                    ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md"
                    : "bg-gray-700 text-white hover:bg-gray-800 shadow-md"
                }`}
              >
                {autoPlay ? "⏸ Pausar auto" : "▶ Continuar auto"}
              </button>

              {index < AFFIRMATIONS.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={finishReading}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  ✓ Finalizar
                </button>
              )}
            </div>
          )}
        </div>

        {/* ✅ CTA para iniciar (se mantiene) */}
        {!isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <p className="text-white/90 mb-6 drop-shadow">
              Presiona Iniciar para comenzar
              <br />
              <span className="text-sm">(8 afirmaciones con pausas de 8 segundos)</span>
            </p>

            <button
              onClick={startRecording}
              className="px-12 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition flex items-center gap-3 mx-auto"
            >
              <span className="text-2xl">▶</span>
              <span>Iniciar lectura</span>
            </button>
          </motion.div>
        )}

        {/* ✅ Instrucciones (se mantienen) */}
        {!isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-teal-50 rounded-2xl p-6 border-2 border-teal-200"
          >
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>💡</span>
              <span>Cómo usar este ejercicio</span>
            </h4>

            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-teal-500 font-bold">1.</span>
                Lee cada afirmación en voz alta con convicción y emoción
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 font-bold">2.</span>
                El ejercicio avanza automáticamente cada 8 segundos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 font-bold">3.</span>
                Puedes controlar manualmente con los botones o pausar el auto-avance
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 font-bold">4.</span>
                Al finalizar todas las afirmaciones, tu voz será analizada
              </li>
            </ul>

            <div className="mt-4 p-3 bg-white rounded-lg border border-teal-200">
              <p className="text-sm text-gray-700">
                <strong>Beneficio:</strong> Las afirmaciones positivas ayudan a reprogramar pensamientos negativos y fortalecer la autoestima.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default VocalAffirmations;
