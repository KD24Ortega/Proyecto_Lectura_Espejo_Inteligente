import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";

// ✅ Reconocimiento
import FaceMonitor from "../components/FaceMonitor";

// ✅ Hook de theme dinámico
import useDynamicTheme from "../hooks/useDynamicTheme";

function VocalPractice() {
  const navigate = useNavigate();

  // SECUENCIA MUSICAL
  const MUSICAL_SEQUENCE = [
    { note: "Do", color: "bg-red-500", colorLight: "bg-red-100", frequency: 261.63 },
    { note: "Re", color: "bg-orange-500", colorLight: "bg-orange-100", frequency: 293.66 },
    { note: "Mi", color: "bg-green-500", colorLight: "bg-green-100", frequency: 329.63 },
    { note: "Re", color: "bg-orange-500", colorLight: "bg-orange-100", frequency: 293.66 },
    { note: "Do", color: "bg-red-500", colorLight: "bg-red-100", frequency: 261.63 }
  ];

  const [currentMode, setCurrentMode] = useState("notes"); // "notes" o "eve"
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [completedSequences, setCompletedSequences] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const sequenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // ✅ THEME dinámico
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg = theme?.colors?.primary || "from-teal-100 via-cyan-100 to-blue-100";

  useEffect(() => {
    // Inicializar Web Audio API
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sequenceTimerRef.current) clearInterval(sequenceTimerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // ─────────────────────────────────────────────
  // REPRODUCIR NOTA
  // ─────────────────────────────────────────────
  const playNote = (frequency, duration = 500) => {
    if (!audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContextRef.current.currentTime + duration / 1000
    );

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  };

  // ─────────────────────────────────────────────
  // REPRODUCIR SECUENCIA COMPLETA
  // ─────────────────────────────────────────────
  const playSequence = () => {
    setIsPlaying(true);
    let index = 0;

    const playNextNote = () => {
      if (index < MUSICAL_SEQUENCE.length) {
        setCurrentNoteIndex(index);
        playNote(MUSICAL_SEQUENCE[index].frequency, 800);
        index++;
        setTimeout(playNextNote, 1000);
      } else {
        setCurrentNoteIndex(-1);
        setIsPlaying(false);
      }
    };

    playNextNote();
  };

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
      setTimeElapsed(0);
      setCurrentNoteIndex(0);

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

      // Iniciar secuencia automática
      startSequence();
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      alert("No se pudo acceder al micrófono. Por favor, permite el acceso.");
    }
  };

  // ─────────────────────────────────────────────
  // SECUENCIA AUTOMÁTICA
  // ─────────────────────────────────────────────
  const startSequence = () => {
    let noteIndex = 0;
    let sequences = 0;

    const advanceNote = () => {
      if (noteIndex < MUSICAL_SEQUENCE.length) {
        setCurrentNoteIndex(noteIndex);
        noteIndex++;
      } else {
        // Secuencia completada
        sequences++;
        setCompletedSequences(sequences);
        noteIndex = 0;

        // Continuar con la siguiente secuencia
        setCurrentNoteIndex(0);
      }
    };

    // Avanzar cada 2 segundos
    sequenceTimerRef.current = setInterval(advanceNote, 2000);
    advanceNote(); // Primera nota inmediata
  };

  // ─────────────────────────────────────────────
  // DETENER GRABACIÓN
  // ─────────────────────────────────────────────
  const finishPractice = () => {
    clearInterval(timerRef.current);
    clearInterval(sequenceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setCurrentNoteIndex(-1);
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
      fd.append("audio_file", audioBlob, "vocal_practice.wav");
      fd.append("user_id", userId);
      fd.append("exercise_id", "3"); // ID del ejercicio de Práctica Vocal
      fd.append("duration_seconds", timeElapsed);
      fd.append("gender", gender);
      fd.append("completed", true);

      const response = await api.post("/api/voice/sessions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setAnalysisResults(response.data);
      setShowResults(true);
    } catch (error) {
      console.error("Error al procesar práctica vocal:", error);
      alert("Error al procesar tu práctica vocal. Por favor, intenta nuevamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ─────────────────────────────────────────────
  // ✅ LOADING THEME (evita fondo tarde)
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  //  PANTALLA CARGANDO
  // ─────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6 transition-all duration-1000`}>
        <FaceMonitor isActive={true} />

        <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md">
          <div className="w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Analizando tu voz…</h2>
          <p className="text-gray-600">Procesando tu práctica vocal</p>
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
              ✅ Práctica Completada
            </h1>
            <p className="text-white/90 drop-shadow">
              Duración: {formatTime(timeElapsed)} | Secuencias: {completedSequences}
            </p>
          </div>

          {/* Resultados del análisis */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>Análisis de tu Voz</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
                <p className="text-sm text-gray-600 mb-1">Tono de voz</p>
                <p className="text-2xl font-bold text-orange-600">{analysisResults.pitch_mean} Hz</p>
                <p className="text-xs text-gray-500 mt-1">Variabilidad: {analysisResults.pitch_std}</p>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                <p className="text-sm text-gray-600 mb-1">Energía vocal</p>
                <p className="text-2xl font-bold text-green-600">{(analysisResults.energy * 100).toFixed(1)}%</p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Actividad vocal</p>
                <p className="text-2xl font-bold text-blue-600">{(analysisResults.voice_ratio * 100).toFixed(0)}%</p>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Calidad de voz (HNR)</p>
                <p className="text-2xl font-bold text-purple-600">{analysisResults.hnr.toFixed(1)} dB</p>
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
              className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
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

      <div className="max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/exercises/anxiety")}
            className="flex items-center gap-2 text-white/90 hover:text-white font-medium transition mb-4 drop-shadow"
          >
            <span className="text-xl">←</span>
            <span>Volver</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-orange-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🎵</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Práctica Vocal</h1>
                <p className="text-gray-600 mt-1">Ejercicios de voz y canto para liberar tensión</p>
              </div>
            </div>
          </div>
        </div>

        {/* SELECTOR DE MODO */}
        <div className="bg-white rounded-2xl p-4 shadow-lg mb-8 border-2 border-orange-100">
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setCurrentMode("notes")}
              disabled={isRecording}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${
                currentMode === "notes"
                  ? "bg-gray-800 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span>🎵</span>
              <span>Canto / Tonos</span>
            </button>
            <button
              onClick={() => setCurrentMode("eve")}
              disabled={isRecording}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${
                currentMode === "eve"
                  ? "bg-gray-800 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span>🔊</span>
              <span>EVE</span>
            </button>
          </div>
        </div>

        {/* SECUENCIA MUSICAL */}
        {currentMode === "notes" && (
          <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8 border-2 border-orange-50">
            <h3 className="text-center text-xl font-bold text-gray-800 mb-8">Secuencia Musical</h3>

            <div className="flex justify-center items-center gap-4 mb-10">
              {MUSICAL_SEQUENCE.map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <motion.div
                    animate={{
                      scale: currentNoteIndex === index ? 1.2 : 1,
                      y: currentNoteIndex === index ? -10 : 0
                    }}
                    transition={{ duration: 0.3 }}
                    className={`w-16 h-16 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-xl shadow-lg ${
                      currentNoteIndex === index ? "ring-4 ring-yellow-400" : ""
                    }`}
                  >
                    {item.note}
                  </motion.div>
                  {index < MUSICAL_SEQUENCE.length - 1 && <span className="text-gray-400 text-2xl">→</span>}
                </div>
              ))}
            </div>

            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center items-center gap-6 mb-8 pb-6 border-b-2 border-gray-100"
              >
                <div>
                  <p className="text-3xl font-bold text-orange-600">{completedSequences}</p>
                  <p className="text-sm text-gray-600 text-center">Secuencias</p>
                </div>
                <div className="w-px h-12 bg-gray-300"></div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">{formatTime(timeElapsed)}</p>
                  <p className="text-sm text-gray-600 text-center">Tiempo</p>
                </div>
                <div className="w-px h-12 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-gray-700">Grabando</span>
                </div>
              </motion.div>
            )}

            <div className="bg-orange-50 rounded-xl p-6 mb-8 border-2 border-orange-200">
              <h4 className="font-bold text-gray-800 mb-3">Instrucciones:</h4>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex items-start gap-2"><span className="text-orange-500">•</span> Canta cada nota con claridad y sostén brevemente</li>
                <li className="flex items-start gap-2"><span className="text-orange-500">•</span> Sigue la secuencia: Do → Re → Mi → Re → Do</li>
                <li className="flex items-start gap-2"><span className="text-orange-500">•</span> Repite el patrón varias veces para mejorar tu respiración</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {!isRecording ? (
                <>
                  <button
                    onClick={playSequence}
                    disabled={isPlaying}
                    className={`px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 ${
                      isPlaying ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <span className="text-xl">🔊</span>
                    <span>{isPlaying ? "Reproduciendo..." : "Escuchar secuencia"}</span>
                  </button>

                  <button
                    onClick={startRecording}
                    className="px-10 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-lg transition-all hover:scale-105"
                  >
                    <span className="text-2xl">▶</span>
                    <span>Iniciar</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={finishPractice}
                  className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-lg transition-all"
                >
                  <span className="text-2xl">✓</span>
                  <span>Finalizar</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODO EVE */}
        {currentMode === "eve" && (
          <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8 border-2 border-orange-50">
            <h3 className="text-center text-xl font-bold text-gray-800 mb-8">
              Ejercicio EVE (Emisión Vocal Extendida)
            </h3>

            <div className="bg-blue-50 rounded-xl p-8 mb-8 border-2 border-blue-200 text-center">
              <p className="text-6xl mb-4">🗣️</p>
              <p className="text-4xl font-bold text-gray-800 mb-4">"EEEEE"</p>
              <p className="text-gray-600">Mantén este sonido de forma continua y sostenida</p>
            </div>

            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center items-center gap-6 mb-8 pb-6 border-b-2 border-gray-100"
              >
                <div>
                  <p className="text-3xl font-bold text-blue-600">{formatTime(timeElapsed)}</p>
                  <p className="text-sm text-gray-600 text-center">Tiempo</p>
                </div>
                <div className="w-px h-12 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-gray-700">Grabando</span>
                </div>
              </motion.div>
            )}

            <div className="bg-blue-50 rounded-xl p-6 mb-8 border-2 border-blue-200">
              <h4 className="font-bold text-gray-800 mb-3">Instrucciones:</h4>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Inhala profundamente por la nariz</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Emite el sonido "EEEEE" de forma continua</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Mantén el tono constante hasta que necesites respirar</li>
                <li className="flex items-start gap-2"><span className="text-blue-500">•</span> Repite varias veces para mejorar el control vocal</li>
              </ul>
            </div>

            <div className="flex justify-center">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-lg transition-all hover:scale-105"
                >
                  <span className="text-2xl">▶</span>
                  <span>Iniciar</span>
                </button>
              ) : (
                <button
                  onClick={finishPractice}
                  className="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 text-lg transition-all"
                >
                  <span className="text-2xl">✓</span>
                  <span>Finalizar</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONTADOR DE SECUENCIAS COMPLETADAS */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-orange-100 text-center">
          <p className="text-gray-600 text-sm mb-2">Secuencias Completadas</p>
          <p className="text-5xl font-bold text-orange-600">{completedSequences}</p>
        </div>
      </div>
    </div>
  );
}

export default VocalPractice;
