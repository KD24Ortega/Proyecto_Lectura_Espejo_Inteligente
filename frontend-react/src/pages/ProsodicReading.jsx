import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

import FaceMonitor from "../components/FaceMonitor";
import useDynamicTheme from "../hooks/useDynamicTheme";

function ProsodicReading() {
  const navigate = useNavigate();

  // ✅ THEME dinámico
  const { theme, isThemeLoading } = useDynamicTheme();

  // TEXTOS DE PRÁCTICA
  const TEXTS = {
    sport: {
      title: "Deporte y Determinación",
      content: [
        "Han pasado muchos años hasta que otro deportista pueda arrebatarle a Aimar Olaizola el título del mejor pelotari",
        "Ha disputado siete finales, siete campeonatos ganados y una técnica que las futuras generaciones admirarán en video",
        "Ese nivel no lo alcanzó jugando en soledad, sino enfrentándose a rivales exigentes que pusieron a prueba cada aspecto de su juego",
        "Eso era lo único que faltaba al gran campeón, una final verdaderamente memorable"
      ],
      pauses: { long: "//", short: "," }
    },
    nature: {
      title: "Naturaleza y Serenidad",
      content: [
        "El bosque despierta lentamente con los primeros rayos del sol, mientras las aves comienzan su melodioso canto matutino",
        "Cada árbol cuenta una historia diferente, historias de tormentas superadas y primaveras florecientes que renuevan la esperanza",
        "El río fluye sin prisa entre las rocas, su murmullo constante nos recuerda que todo sigue su curso natural",
        "En este santuario de paz encontramos el equilibrio que tanto necesitamos, un refugio del bullicio cotidiano"
      ],
      pauses: { long: "//", short: "," }
    },
    personal: {
      title: "Superación Personal",
      content: [
        "Cada desafío que enfrentamos nos transforma en versiones más fuertes de nosotros mismos, moldeando nuestro carácter con cada victoria",
        "No importa cuántas veces caigamos en el camino, lo verdaderamente importante es encontrar la fuerza para levantarnos de nuevo",
        "Los errores del pasado son lecciones valiosas, no cargas que debemos llevar para siempre con nosotros",
        "El futuro está lleno de posibilidades infinitas, esperando a que demos el primer paso con valentía y determinación"
      ],
      pauses: { long: "//", short: "," }
    }
  };

  const [selectedText, setSelectedText] = useState("sport");
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setIsRecording(true);
      setTimeElapsed(0);
      setCurrentParagraph(0);

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

  const finishReading = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendAudio = async (audioBlob) => {
    setIsAnalyzing(true);

    try {
      const userId = localStorage.getItem("user_id");
      const gender = localStorage.getItem("user_gender") || "neutro";

      const fd = new FormData();
      fd.append("audio_file", audioBlob, "prosodic_reading.wav");
      fd.append("user_id", userId);
      fd.append("exercise_id", "4");
      fd.append("duration_seconds", timeElapsed);
      fd.append("gender", gender);
      fd.append("completed", true);

      const response = await api.post("/api/voice/sessions", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setAnalysisResults(response.data);
      setShowResults(true);
    } catch (error) {
      console.error("Error al procesar lectura:", error);
      alert("Error al procesar tu lectura. Por favor, intenta nuevamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderTextWithPauses = (text) => {
    const parts = text.split(/(\/{2}|,)/);

    return parts.map((part, index) => {
      if (part === "//") {
        return (
          <span key={index} className="inline-flex items-center mx-1">
            <span className="w-8 h-1 bg-red-400 rounded"></span>
            <span className="w-8 h-1 bg-red-400 rounded ml-1"></span>
          </span>
        );
      } else if (part === ",") {
        return (
          <span key={index} className="inline-flex items-center mx-1">
            <span className="w-6 h-1 bg-yellow-400 rounded"></span>
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const currentText = TEXTS[selectedText];
  const bg = theme?.colors?.primary || "from-indigo-100 via-purple-100 to-pink-100";

  // ✅ LOADING DE THEME (ya con fondo)
  if (isThemeLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-white drop-shadow-lg">Cargando lectura...</p>
        </div>
      </div>
    );
  }

  // ✅ ANALIZANDO (con fondo dinámico)
  if (isAnalyzing) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6`}>
        <FaceMonitor isActive={!isAnalyzing} />

        <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md">
          <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Analizando tu lectura…</h2>
          <p className="text-gray-600">Procesando tu expresividad vocal</p>
        </div>
      </div>
    );
  }

  // ✅ RESULTADOS (con fondo dinámico)
  if (showResults && analysisResults) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} p-6`}>
        <FaceMonitor isActive={true} />
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate("/exercises/depression")}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition mb-4"
            >
              <span className="text-xl">←</span>
              <span>Volver a ejercicios</span>
            </button>

            <h1 className="text-3xl font-bold text-gray-800 mb-2">✅ Lectura Completada</h1>
            <p className="text-gray-600">
              Duración: {formatTime(timeElapsed)} | Texto: {currentText.title}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>Análisis de tu Voz</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-indigo-50 rounded-xl p-4 border-2 border-indigo-200">
                <p className="text-sm text-gray-600 mb-1">Tono de voz</p>
                <p className="text-2xl font-bold text-indigo-600">{analysisResults.pitch_mean} Hz</p>
                <p className="text-xs text-gray-500 mt-1">Variabilidad: {analysisResults.pitch_std}</p>
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

              <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Calidad de voz (HNR)</p>
                <p className="text-2xl font-bold text-purple-600">
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
                  <p className="font-bold text-gray-800 text-lg">Estado emocional detectado</p>
                  <p className="text-sm text-gray-600">Puntuación: {analysisResults.score.toFixed(1)}/10</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
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

  // ✅ UI PRINCIPAL (con fondo dinámico + FaceMonitor)
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-6 relative`}>
      <FaceMonitor isActive={true} />

      <div className="max-w-4xl mx-auto">
        {/* (tu UI igual, sin cambios, solo reemplazamos el fondo) */}

        {/* HEADER */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/exercises/depression")}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition mb-4"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-indigo-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">📚</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Lectura Prosódica</h1>
                <p className="text-gray-600 mt-1">Ejercicios de lectura con pausas y entonación</p>
              </div>
            </div>
          </div>
        </div>

        {/* SELECTOR DE TEXTO */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-8 border-2 border-indigo-100">
          <h3 className="font-bold text-gray-800 mb-4">Selecciona un Texto</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => !isRecording && setSelectedText("sport")}
              disabled={isRecording}
              className={`p-4 rounded-xl border-2 transition ${
                selectedText === "sport"
                  ? "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-400 text-orange-800"
                  : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-semibold">Deporte y Determinación</div>
            </button>

            <button
              onClick={() => !isRecording && setSelectedText("nature")}
              disabled={isRecording}
              className={`p-4 rounded-xl border-2 transition ${
                selectedText === "nature"
                  ? "bg-gradient-to-r from-green-50 to-green-100 border-green-400 text-green-800"
                  : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-2xl mb-2">🌲</div>
              <div className="font-semibold">Naturaleza y Serenidad</div>
            </button>

            <button
              onClick={() => !isRecording && setSelectedText("personal")}
              disabled={isRecording}
              className={`p-4 rounded-xl border-2 transition ${
                selectedText === "personal"
                  ? "bg-gradient-to-r from-purple-50 to-purple-100 border-purple-400 text-purple-800"
                  : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-2xl mb-2">💪</div>
              <div className="font-semibold">Superación Personal</div>
            </button>
          </div>
        </div>

        {/* TEXTO DE PRÁCTICA */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 mb-8 border-2 border-indigo-50">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">📄</span>
            <h3 className="text-xl font-bold text-gray-800">Texto de Práctica</h3>
          </div>

          <div className="bg-indigo-50 rounded-xl p-8 mb-6 border-2 border-indigo-200">
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div
                  key={currentParagraph}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-xl leading-relaxed text-gray-800"
                >
                  {renderTextWithPauses(currentText.content[currentParagraph])}
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {currentText.content.map((paragraph, idx) => (
                    <p key={idx} className="text-lg leading-relaxed text-gray-800">
                      {renderTextWithPauses(paragraph)}
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isRecording && (
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setCurrentParagraph(Math.max(0, currentParagraph - 1))}
                disabled={currentParagraph === 0}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  currentParagraph === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                }`}
              >
                ← Anterior
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">Párrafo</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {currentParagraph + 1} / {currentText.content.length}
                </p>
              </div>

              <button
                onClick={() =>
                  setCurrentParagraph(Math.min(currentText.content.length - 1, currentParagraph + 1))
                }
                disabled={currentParagraph === currentText.content.length - 1}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  currentParagraph === currentText.content.length - 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                }`}
              >
                Siguiente →
              </button>
            </div>
          )}

          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center items-center gap-6 mb-6 pb-6 border-t-2 border-gray-100 pt-6"
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-gray-700">Grabando</span>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div>
                <p className="text-3xl font-bold text-indigo-600">{formatTime(timeElapsed)}</p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-center">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-12 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition flex items-center gap-3"
              >
                <span className="text-2xl">▶</span>
                <span>Comenzar Lectura</span>
              </button>
            ) : (
              <button
                onClick={finishReading}
                className="px-12 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full font-bold text-lg hover:shadow-2xl transition flex items-center gap-3"
              >
                <span className="text-2xl">✓</span>
                <span>Finalizar</span>
              </button>
            )}
          </div>
        </div>

        {/* GUÍA */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-indigo-100">
          <h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2">
            <span>📖</span>
            <span>Guía de Lectura</span>
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1">
                  <span className="w-6 h-1 bg-red-400 rounded"></span>
                  <span className="w-6 h-1 bg-red-400 rounded"></span>
                </div>
                <span className="font-bold text-red-700">Pausa Larga</span>
              </div>
              <p className="text-sm text-gray-700">Toma aire y haz una pausa completa</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-1 bg-yellow-400 rounded"></span>
                <span className="font-bold text-yellow-700">Pausa Corta</span>
              </div>
              <p className="text-sm text-gray-700">Breve pausa para marcar ritmo</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-gray-700">
              <strong>💡 Consejo:</strong> Lee con expresividad, variando tu tono e intensidad. Respeta las pausas
              señaladas para mejorar tu expresión vocal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProsodicReading;
