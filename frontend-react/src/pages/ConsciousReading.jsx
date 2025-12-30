import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

// ✅ Reconocimiento
import FaceMonitor from "../components/FaceMonitor";

// ✅ Música de fondo
import BackgroundMusic from "../components/BackgroundMusic";

// ✅ Hook de theme dinámico
import useDynamicTheme from "../hooks/useDynamicTheme";
import { notifyError } from "../utils/toast";

function ConsciousReading() {
  const navigate = useNavigate();

  // FRASES
  const PHRASES = [
    "Mi cuerpo se relaja poco a poco",
    "Todo está bien en este momento",
    "Siento paz mientras respiro",
    "Dejo ir cualquier tensión innecesaria",
    "Permito que mi mente descanse"
  ];

  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [phrasesRead, setPhrasesRead] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const autoTimerRef = useRef(null);

  // ✅ THEME dinámico
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg = theme?.colors?.primary || "from-purple-100 via-pink-100 to-blue-100";

  // Pausar música mientras el micrófono esté activo
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(isRecording ? "bgm:pause" : "bgm:resume"));
    return () => {
      window.dispatchEvent(new CustomEvent("bgm:resume"));
    };
  }, [isRecording]);

  // AUTO ROTACIÓN
  useEffect(() => {
    if (autoPlay && isRecording && index < PHRASES.length - 1) {
      autoTimerRef.current = setTimeout(() => {
        setIndex((prev) => prev + 1);
        setPhrasesRead((prev) => prev + 1);
      }, 6000);
    }
    return () => clearTimeout(autoTimerRef.current);
  }, [autoPlay, index, isRecording]);

  // INICIAR GRABACIÓN AUTOMÁTICAMENTE AL COMENZAR
  useEffect(() => {
    if (isRecording && index === 0 && phrasesRead === 0) {
      setPhrasesRead(1);
    }
  }, [isRecording, index, phrasesRead]);

  // ============================================
  //   GRABACIÓN
  // ============================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        analyzeAudio(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setAutoPlay(true); // Iniciar auto-play por defecto

      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      notifyError("No se pudo acceder al micrófono.");
    }
  };

  const finishReading = () => {
    clearInterval(timerRef.current);
    clearTimeout(autoTimerRef.current);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleNext = () => {
    if (index < PHRASES.length - 1) {
      setIndex((prev) => prev + 1);
      setPhrasesRead((prev) => prev + 1);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ============================================
  //   ANALIZAR AUDIO
  // ============================================
  const analyzeAudio = async (blob) => {
    setIsAnalyzing(true);
    try {
      const userId = localStorage.getItem("user_id");
      const gender = localStorage.getItem("user_gender") || "neutro";

      const fd = new FormData();
      fd.append("audio_file", blob, "reading.wav");
      fd.append("user_id", userId);
      fd.append("exercise_id", "2"); // ID del ejercicio de Lectura Consciente
      fd.append("duration_seconds", timeElapsed);
      fd.append("gender", gender);
      fd.append("completed", true);

      const res = await api.post("/api/voice/sessions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setAnalysisResults(res.data);
    } catch (err) {
      notifyError("Error al analizar audio.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ============================================
  // ✅ LOADING THEME (evita flash)
  // ============================================
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

  // ============================================
  //   PANTALLA CARGANDO
  // ============================================
  if (isAnalyzing) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6 transition-all duration-1000`}>
        <FaceMonitor isActive={!isAnalyzing} />

        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md">
          <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Analizando tu voz...</h2>
          <p className="text-gray-600">Procesando los biomarcadores vocales de tu lectura</p>
        </div>

        <BackgroundMusic musicFile={theme?.music} volume={0.2} />
      </div>
    );
  }

  // ============================================
  //   PANTALLA FINAL
  // ============================================
  if (analysisResults) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000`}>
        <FaceMonitor isActive={true} />

        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate("/exercises/anxiety")}
              className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
            >
              <span className="text-xl">←</span>
              <span>Volver a ejercicios</span>
            </button>

            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
              ✅ Lectura Completada
            </h1>
            <p className="text-white/90 drop-shadow">
              Duración: {formatTime(timeElapsed)} | Frases leídas: {phrasesRead}
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
              <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Tono de voz</p>
                <p className="text-2xl font-bold text-purple-600">{analysisResults.pitch_mean} Hz</p>
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
              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Actividad vocal</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(analysisResults.voice_ratio * 100).toFixed(0)}%
                </p>
              </div>

              {/* HNR */}
              <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
                <p className="text-sm text-gray-600 mb-1">Calidad de voz (HNR)</p>
                <p className="text-2xl font-bold text-orange-600">{analysisResults.hnr.toFixed(1)} dB</p>
              </div>
            </div>

            {/* Nivel de riesgo */}
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
                  <p className="font-bold text-gray-800 text-lg">Estado emocional detectado</p>
                  <p className="text-sm text-gray-600">Puntuación: {analysisResults.score.toFixed(1)}/10</p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              🔄 Repetir ejercicio
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              📊 Ver mi progreso
            </button>
          </div>
        </div>

        <BackgroundMusic musicFile={theme?.music} volume={0.2} />
      </div>
    );
  }

  // ============================================
  //   UI PRINCIPAL
  // ============================================
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000`}>
      <FaceMonitor isActive={true} />

      <div className="max-w-2xl mx-auto">
        {/* HEADER MEJORADO */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/exercises/anxiety")}
            className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-purple-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">📖</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Lectura Consciente</h1>
                <p className="text-gray-600 mt-1">Lee despacio y siente cada palabra</p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8">
          {/* Stats superiores */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-between items-center mb-8 pb-6 border-b-2 border-gray-100"
            >
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{phrasesRead}/5</p>
                <p className="text-sm text-gray-600">Frases leídas</p>
              </div>
              <div className="w-px h-12 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{formatTime(timeElapsed)}</p>
                <p className="text-sm text-gray-600">Tiempo</p>
              </div>
              <div className="w-px h-12 bg-gray-200"></div>
              <div className="text-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <p className="text-sm font-semibold text-gray-700">Grabando</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* FRASE ACTUAL CON ANIMACIÓN MEJORADA */}
          <div className="min-h-[200px] flex items-center justify-center mb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative"
              >
                <span className="absolute -top-4 -left-4 text-6xl text-purple-200 font-serif">"</span>
                <p className="text-center text-3xl md:text-4xl font-semibold text-gray-800 leading-relaxed px-12">
                  {PHRASES[index]}
                </p>
                <span className="absolute -bottom-8 -right-4 text-6xl text-purple-200 font-serif">"</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* INDICADORES DE AVANCE MEJORADOS */}
          <div className="flex justify-center gap-3 mb-10">
            {PHRASES.map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8 }}
                animate={{
                  scale: i === index ? 1.2 : 1,
                  backgroundColor: i <= index ? "#8b5cf6" : "#e5e7eb"
                }}
                transition={{ duration: 0.3 }}
                className={`h-2 rounded-full ${i === index ? "w-12" : "w-8"} transition-all`}
              />
            ))}
          </div>

          {/* BOTONES MEJORADOS */}
          {isRecording && (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                disabled={index === 0}
                className={`px-8 py-3 rounded-xl font-semibold transition ${
                  index === 0
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                ← Anterior
              </button>

              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`px-8 py-3 rounded-xl font-semibold transition ${
                  autoPlay
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-gray-700 text-white hover:bg-gray-800"
                }`}
              >
                {autoPlay ? "⏸ Pausar auto" : "▶ Continuar auto"}
              </button>

              {index < PHRASES.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
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

        {/* BOTÓN INICIAR */}
        {!isRecording && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <p className="text-white/90 mb-6 drop-shadow">
              Presiona Iniciar para comenzar<br />
              <span className="text-sm">(5 frases con pausas de 6 segundos)</span>
            </p>
            <button
              onClick={startRecording}
              className="px-12 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition flex items-center gap-3 mx-auto"
            >
              <span className="text-2xl">▶</span>
              <span>Iniciar lectura</span>
            </button>
          </motion.div>
        )}

        {/* GUÍA DE USO */}
        {!isRecording && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-100 mt-8">
            <h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2">
              <span>💡</span> Cómo funciona
            </h3>

            <div className="space-y-3 text-gray-700">
              <p className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">1.</span>
                Lee cada frase en voz alta, con calma y claridad
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">2.</span>
                Tómate 6 segundos entre cada frase para respirar
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">3.</span>
                El ejercicio avanza automáticamente o puedes controlarlo manualmente
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">4.</span>
                Tu voz será analizada para detectar patrones de ansiedad
              </p>
            </div>

            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Beneficio:</strong> La lectura consciente ayuda a reducir la frecuencia cardíaca y calmar la mente.
              </p>
            </div>
          </div>
        )}
      </div>

      <BackgroundMusic musicFile={theme?.music} volume={0.2} />
    </div>
  );
}

export default ConsciousReading;
