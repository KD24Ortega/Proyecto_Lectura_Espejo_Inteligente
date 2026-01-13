import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

import FaceMonitor from "../components/FaceMonitor";
import BackgroundMusic from "../components/BackgroundMusic";
import useDynamicTheme from "../hooks/useDynamicTheme";
import { notifyError } from "../utils/toast";

const MOTION = motion;

function GuidedDialogue() {
  const navigate = useNavigate();

  // ✅ THEME dinámico (igual que AnxietyExercises)
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg =
    theme?.colors?.primary || "from-emerald-100 via-teal-100 to-cyan-100";

  // PREGUNTAS REFLEXIVAS
  const QUESTIONS = [
    { id: 1, text: "¿Qué agradeces hoy?", category: "Gratitud" },
    { id: 2, text: "¿Qué cosa pequeña fue buena hoy?", category: "Gratitud" },
    { id: 3, text: "¿Qué hiciste hoy que antes no querías hacer?", category: "Logros" },
    { id: 4, text: "¿Qué podría ayudarte a descansar mejor hoy?", category: "Bienestar" },
    { id: 5, text: "¿Qué meta pequeña tienes ahora?", category: "Metas" },
    { id: 6, text: "¿Qué te gustaría intentar mañana?", category: "Futuro" },
    { id: 7, text: "¿En qué te gustaría mejorar?", category: "Crecimiento" },
    { id: 8, text: "¿Qué aprendiste hoy sobre ti?", category: "Autoconocimiento" },
    { id: 9, text: "¿Qué pensamiento quisieras cambiar?", category: "Reflexión" },
    { id: 10, text: "¿Qué valoras de ti hoy?", category: "Autoestima" },
    { id: 11, text: "¿Cuál es tu mejor cualidad?", category: "Autoestima" },
    { id: 12, text: "¿Qué te dirías a ti mismo si fueras tu amigo?", category: "Autocompasión" },
  ];

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingQuestion, setRecordingQuestion] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Pausar música mientras el micrófono esté activo
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(isRecording ? "bgm:pause" : "bgm:resume"));
    return () => {
      window.dispatchEvent(new CustomEvent("bgm:resume"));
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setIsRecording(true);
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
      notifyError("No se pudo acceder al micrófono. Por favor, permite el acceso.");
    }
  };

  // ─────────────────────────────────────────────
  // GRABAR RESPUESTA A PREGUNTA ACTUAL
  // ─────────────────────────────────────────────
  const startAnswering = () => {
    setRecordingQuestion(true);
  };

  const stopAnswering = () => {
    setRecordingQuestion(false);

    setAnsweredQuestions((prev) => {
      if (prev.includes(currentQuestionIndex)) return prev;
      return [...prev, currentQuestionIndex];
    });

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex((i) => i + 1);
      }, 500);
    }
  };

  // ─────────────────────────────────────────────
  // FINALIZAR SESIÓN
  // ─────────────────────────────────────────────
  const finishSession = () => {
    clearInterval(timerRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingQuestion(false);
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
      fd.append("audio_file", audioBlob, "guided_dialogue.wav");
      fd.append("user_id", userId);
      fd.append("exercise_id", "6");
      fd.append("duration_seconds", timeElapsed);
      fd.append("gender", gender);
      fd.append("completed", true);

      const response = await api.post("/api/voice/sessions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setAnalysisResults(response.data);
      setShowResults(true);
    } catch (error) {
      console.error("Error al procesar diálogo:", error);
      notifyError("Error al procesar tu diálogo. Por favor, intenta nuevamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const progressPercent = ((currentQuestionIndex + 1) / QUESTIONS.length) * 100;

  // ─────────────────────────────────────────────
  // ✅ LOADING THEME (para que no salga blanco)
  // ─────────────────────────────────────────────
  if (isThemeLoading) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-white drop-shadow-lg">Cargando diálogo...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  PANTALLA ANALIZANDO (ya con theme)
  // ─────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6`}
      >
        <FaceMonitor isActive={!isAnalyzing} />

        <div className="bg-white p-12 rounded-ui-xl shadow-elevated text-center max-w-md">
          <div className="w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Analizando tu diálogo…
          </h2>
          <p className="text-gray-600">Procesando tus respuestas</p>
        </div>

        <BackgroundMusic musicFile={theme?.music} volume={0.2} />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  RESULTADOS (ya con theme)
  // ─────────────────────────────────────────────
  if (showResults && analysisResults) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} p-6`}>
        <FaceMonitor isActive={true} />

        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate("/exercises/depression")}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 backdrop-blur-md text-gray-900 hover:bg-white transition shadow-card border border-white/60"
            >
              <span className="text-xl">←</span>
              <span>Volver a ejercicios</span>
            </button>

            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              ✅ Diálogo Completado
            </h1>
            <p className="text-gray-600">
              Duración: {formatTime(timeElapsed)} | Preguntas respondidas:{" "}
              {answeredQuestions.length}
            </p>
          </div>

          <div className="bg-white rounded-ui-lg shadow-card p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>Análisis de tu Voz</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-emerald-50 rounded-ui-md p-4 border-2 border-emerald-200">
                <p className="text-sm text-gray-600 mb-1">Tono de voz</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {analysisResults.pitch_mean} Hz
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Variabilidad: {analysisResults.pitch_std}
                </p>
              </div>

              <div className="bg-green-50 rounded-ui-md p-4 border-2 border-green-200">
                <p className="text-sm text-gray-600 mb-1">Energía vocal</p>
                <p className="text-2xl font-bold text-green-600">
                  {(analysisResults.energy * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-blue-50 rounded-ui-md p-4 border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Actividad vocal</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(analysisResults.voice_ratio * 100).toFixed(0)}%
                </p>
              </div>

              <div className="bg-teal-50 rounded-ui-md p-4 border-2 border-teal-200">
                <p className="text-sm text-gray-600 mb-1">Calidad de voz (HNR)</p>
                <p className="text-2xl font-bold text-teal-600">
                  {analysisResults.hnr.toFixed(1)} dB
                </p>
              </div>
            </div>

            <div
              className={`rounded-ui-md p-6 border-3 ${
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
              className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-ui-sm font-semibold hover:shadow-elevated transition"
            >
              🔄 Repetir ejercicio
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-ui-sm font-semibold hover:shadow-elevated transition"
            >
              📊 Ver mi progreso
            </button>
          </div>
        </div>

        <BackgroundMusic musicFile={theme?.music} volume={0.2} />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  UI PRINCIPAL (ya con theme)
  // ─────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 relative`}>
      <FaceMonitor isActive={true} />

      <div className="max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate("/exercises/depression")}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 backdrop-blur-md text-gray-900 hover:bg-white transition shadow-card border border-white/60"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-ui-lg p-6 shadow-card border-2 border-emerald-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-ui-lg flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">💭</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Diálogo Guiado</h1>
                <p className="text-gray-600 mt-1">
                  Preguntas reflexivas para conectar con tus emociones
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESO */}
        {isRecording && (
          <div className="bg-white rounded-ui-lg p-6 shadow-card mb-8 border-2 border-emerald-100">
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-gray-700">Progreso del diálogo</p>
              <p className="text-2xl font-bold text-emerald-600">
                {currentQuestionIndex + 1}/{QUESTIONS.length}
              </p>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-4 rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"
              />
            </div>

            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-gray-700">Sesión activa</span>
              </div>
              <span className="text-2xl font-bold text-teal-600">
                {formatTime(timeElapsed)}
              </span>
            </div>
          </div>
        )}

        {/* TARJETA DE PREGUNTA */}
        <div className="bg-white rounded-ui-xl shadow-elevated p-12 mb-8 border-2 border-emerald-50">
          <div className="flex justify-between items-center mb-6">
            <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full font-semibold text-sm">
              {currentQuestion.category}
            </span>

            {/* ✅ SE QUITA el texto visual (0/12 respondidas) y similares */}
            {/* Solo dejamos el indicador simple de pregunta actual */}
            <span className="text-gray-400 font-semibold">
              Pregunta {currentQuestionIndex + 1}
            </span>
          </div>

          <div className="min-h-[180px] flex items-center justify-center mb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <p className="text-4xl md:text-5xl font-bold text-gray-800 leading-tight">
                  {currentQuestion.text}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 mb-8"
            >
              {!recordingQuestion ? (
                <div className="flex items-center gap-3 text-gray-500">
                  <span className="text-4xl">💬</span>
                  <p className="text-lg">Presiona el botón para responder</p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                  <p className="text-lg font-semibold text-gray-700">Respondiendo...</p>
                </div>
              )}
            </motion.div>
          )}

          {isRecording && (
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
              <button
                onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                disabled={currentQuestionIndex === 0 || recordingQuestion}
                className={`px-8 py-3 rounded-ui-sm font-semibold transition ${
                  currentQuestionIndex === 0 || recordingQuestion
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 shadow-card hover:shadow-elevated border-2 border-gray-200"
                }`}
              >
                ← Anterior
              </button>

              {!recordingQuestion ? (
                <button
                  onClick={startAnswering}
                  className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-ui-sm font-bold shadow-card hover:shadow-elevated flex items-center justify-center gap-3 text-lg transition-all hover:scale-105"
                >
                  <span className="text-2xl">🎤</span>
                  <span>Grabar Respuesta</span>
                </button>
              ) : (
                <button
                  onClick={stopAnswering}
                  className="px-12 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-ui-sm font-bold shadow-card hover:shadow-elevated flex items-center justify-center gap-3 text-lg transition-all"
                >
                  <span className="text-2xl">✓</span>
                  <span>Finalizar Respuesta</span>
                </button>
              )}

              <button
                onClick={() =>
                  setCurrentQuestionIndex((i) => Math.min(QUESTIONS.length - 1, i + 1))
                }
                disabled={currentQuestionIndex === QUESTIONS.length - 1 || recordingQuestion}
                className={`px-8 py-3 rounded-ui-sm font-semibold transition ${
                  currentQuestionIndex === QUESTIONS.length - 1 || recordingQuestion
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 shadow-card hover:shadow-elevated border-2 border-gray-200"
                }`}
              >
                Siguiente →
              </button>
            </div>
          )}

          <div className="flex justify-center">
            {!isRecording ? (
              <button
                onClick={startSession}
                className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-bold text-lg hover:shadow-elevated transition flex items-center gap-3"
              >
                <span className="text-2xl">▶</span>
                <span>Iniciar Diálogo</span>
              </button>
            ) : (
              <button
                onClick={finishSession}
                disabled={recordingQuestion}
                className={`px-12 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full font-bold text-lg hover:shadow-elevated transition flex items-center gap-3 ${
                  recordingQuestion ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span className="text-2xl">✓</span>
                <span>Finalizar Diálogo</span>
              </button>
            )}
          </div>
        </div>

        {/* ✅ SE ELIMINA COMPLETAMENTE la LISTA de preguntas con “(0/12 respondidas)” */}
        {/* (La lógica answeredQuestions se mantiene porque se usa en resultados) */}

        {!isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-emerald-50 rounded-ui-lg p-6 border-2 border-emerald-200"
          >
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>💡</span>
              <span>Cómo usar este ejercicio</span>
            </h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">1.</span>
                Presiona "Iniciar Diálogo" para comenzar la sesión
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">2.</span>
                Lee cada pregunta con atención y reflexiona sobre tu respuesta
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">3.</span>
                Presiona "Grabar Respuesta" y expresa tus pensamientos en voz alta
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">4.</span>
                Navega entre preguntas y responde las que desees
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">5.</span>
                Al terminar, presiona "Finalizar Diálogo" para el análisis
              </li>
            </ul>

            <div className="mt-4 p-3 bg-white rounded-ui-sm border border-emerald-200">
              <p className="text-sm text-gray-700">
                <strong>Beneficio:</strong> Expresar tus pensamientos en voz alta ayuda a procesar emociones y fortalecer el autoconocimiento.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <BackgroundMusic musicFile={theme?.music} volume={0.2} />
    </div>
  );
}

export default GuidedDialogue;
