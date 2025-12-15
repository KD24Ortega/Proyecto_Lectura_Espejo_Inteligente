import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import FaceMonitor from "../components/FaceMonitor";

// ✅ Hook de theme dinámico
import useDynamicTheme from "../hooks/useDynamicTheme";

function GAD7() {
  const navigate = useNavigate();

  // ✅ Theme dinámico (hook centralizado)
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg = theme?.colors?.primary || "from-teal-100 via-emerald-100 to-cyan-100";

  // Estados principales
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Bloqueo de envío (evita doble submit)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de voz - Text to Speech
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Estados de voz - Speech to Text
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showVoiceConfirm, setShowVoiceConfirm] = useState(false);
  const [detectedAnswer, setDetectedAnswer] = useState(null);

  // Estados de modales
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    type: "error",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false,
  });

  // Estado para salir
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const recognitionRef = useRef(null);

  // ✅ opcional: evita que FaceMonitor frene el primer render
  const [enableFace, setEnableFace] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnableFace(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    loadQuestions();
    initSpeechRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // COMPONENTE MODAL REUTILIZABLE
  // ============================================
  const Modal = ({
    type,
    title,
    message,
    onConfirm,
    onClose,
    showCancel = false,
  }) => {
    const icons = { error: "❌", warning: "⚠️", info: "💡", success: "✅" };

    const colorClasses = {
      error: { title: "text-red-600", button: "bg-red-600 hover:bg-red-700" },
      warning: {
        title: "text-yellow-600",
        button: "bg-yellow-600 hover:bg-yellow-700",
      },
      info: { title: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
      success: {
        title: "text-green-600",
        button: "bg-green-600 hover:bg-green-700",
      },
    };

    const colors = colorClasses[type];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="mb-4 text-6xl"
            >
              {icons[type]}
            </motion.div>

            {title && (
              <h3 className={`text-2xl font-bold ${colors.title} mb-3`}>
                {title}
              </h3>
            )}

            <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>

            <div className="flex gap-3 justify-center">
              {showCancel && (
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all hover:scale-105"
                >
                  Cancelar
                </button>
              )}

              <button
                onClick={onConfirm || onClose}
                className={`px-6 py-3 ${colors.button} text-white rounded-xl font-semibold transition-all shadow-lg hover:scale-105`}
              >
                {showCancel ? "Confirmar" : "Aceptar"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const showModalMessage = (config) => {
    setModalConfig(config);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  // ============================================
  // CARGA DE PREGUNTAS
  // ============================================
  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/gad7/questions");
      setQuestions(response.data.questions);
      setAnswers(new Array(response.data.questions.length).fill(null));
      setIsLoading(false);
    } catch (error) {
      console.error("Error al cargar preguntas:", error);
      setIsLoading(false);
      showModalMessage({
        type: "error",
        title: "Error de conexión",
        message:
          "No se pudieron cargar las preguntas del test. Por favor, verifica tu conexión e intenta nuevamente.",
        onConfirm: () => {
          closeModal();
          navigate("/home");
        },
      });
    }
  };

  // ============================================
  // RECONOCIMIENTO DE VOZ
  // ============================================
  const initSpeechRecognition = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "es-ES";
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setVoiceTranscript("Escuchando...");
        setShowVoiceConfirm(false);
      };

      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceTranscript(`Escuché: "${transcript}"`);

        try {
          const response = await api.post(
            `/voice/map-response?text=${encodeURIComponent(transcript)}`
          );
          const score = response.data.score;

          const answerLabels = [
            "Ningún día",
            "Varios días",
            "Más de la mitad de los días",
            "Casi todos los días",
          ];

          setDetectedAnswer({ score, label: answerLabels[score] });
          setShowVoiceConfirm(true);
        } catch (error) {
          console.error("Error al mapear respuesta:", error);
          setVoiceTranscript("No entendí. Intenta de nuevo.");
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Error de reconocimiento:", event.error);
        setIsListening(false);

        if (event.error === "not-allowed" || event.error === "no-speech") {
          setVoiceTranscript("No se detectó audio. Intenta de nuevo.");
        } else {
          setVoiceTranscript("Error al escuchar. Intenta de nuevo.");
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  };

  const speakQuestion = () => {
    if (!("speechSynthesis" in window)) {
      showModalMessage({
        type: "warning",
        title: "Función no disponible",
        message:
          "Tu navegador no soporta síntesis de voz. Por favor, responde haciendo clic en las opciones.",
        onConfirm: closeModal,
      });
      return;
    }

    window.speechSynthesis.cancel();

    const questionText = `Pregunta ${currentQuestion + 1} de ${
      questions.length
    }. En los últimos días, ¿con qué frecuencia has sentido: ${
      questions[currentQuestion]
    }?`;

    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.lang = "es-ES";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      showModalMessage({
        type: "error",
        title: "Error de audio",
        message:
          "Hubo un problema con la síntesis de voz. Por favor, lee la pregunta.",
        onConfirm: closeModal,
      });
    };

    window.speechSynthesis.speak(utterance);
  };

  const startVoiceRecognition = () => {
    if (!recognitionRef.current) {
      showModalMessage({
        type: "warning",
        title: "Función no disponible",
        message:
          "Tu navegador no soporta reconocimiento de voz. Por favor, responde haciendo clic en las opciones.",
        onConfirm: closeModal,
      });
      return;
    }

    try {
      setVoiceTranscript("");
      recognitionRef.current.start();
    } catch (error) {
      console.error("Error al iniciar reconocimiento:", error);
      showModalMessage({
        type: "error",
        title: "Error de micrófono",
        message:
          "No se pudo iniciar el reconocimiento de voz. Verifica los permisos de tu micrófono.",
        onConfirm: closeModal,
      });
    }
  };

  // ============================================
  // MANEJO DE RESPUESTAS
  // ============================================
  const handleClickAnswer = (value) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);

    setVoiceTranscript("");
    setShowVoiceConfirm(false);
    setDetectedAnswer(null);
  };

  const confirmVoiceAnswer = () => {
    if (detectedAnswer !== null) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = detectedAnswer.score;
      setAnswers(newAnswers);

      setShowVoiceConfirm(false);
      setVoiceTranscript("");
      setDetectedAnswer(null);
    }
  };

  const retryVoice = () => {
    setVoiceTranscript("");
    setShowVoiceConfirm(false);
    setDetectedAnswer(null);
  };

  // ============================================
  // NAVEGACIÓN
  // ============================================
  const handleNext = () => {
    if (isSubmitting) return;

    if (answers[currentQuestion] === null) {
      showModalMessage({
        type: "warning",
        title: "Respuesta requerida",
        message: "Por favor, selecciona una respuesta antes de continuar.",
        onConfirm: closeModal,
      });
      return;
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setVoiceTranscript("");
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
    } else {
      submitTest();
    }
  };

  const handlePrevious = () => {
    if (isSubmitting) return;
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
      setVoiceTranscript("");
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
    }
  };

  const handleExit = () => {
    if (isSubmitting) return;
    setShowExitConfirm(true);
  };

  // ============================================
  // ENVÍO DEL TEST
  // ============================================
  const submitTest = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const userId = localStorage.getItem("user_id") || 1;

      const response = await api.post("/gad7/submit", {
        user_id: parseInt(userId),
        responses: answers,
      });

      localStorage.setItem("last_test_type", "gad7");
      localStorage.setItem("last_gad7_score", response.data.score);
      localStorage.setItem("last_gad7_severity", response.data.severity);

      navigate("/results", {
        state: {
          type: "gad7",
          score: response.data.score,
          severity: response.data.severity,
        },
      });
    } catch (error) {
      console.error("Error al enviar test:", error);
      showModalMessage({
        type: "error",
        title: "Error al enviar",
        message:
          "No se pudieron procesar tus respuestas. Por favor, verifica tu conexión e intenta nuevamente.",
        onConfirm: closeModal,
      });
      setIsSubmitting(false);
    }
  };

  // ============================================
  // LOADING (theme + preguntas)
  // ============================================
  if (isThemeLoading || isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-4">
            <motion.div
              className="absolute inset-0 border-4 border-white/80 rounded-full border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="text-2xl font-semibold text-white/90">Cargando test...</p>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const answerOptions = [
    { value: 0, label: "Ningún día", emoji: "😊", color: "from-green-400 to-emerald-500" },
    { value: 1, label: "Varios días", emoji: "😐", color: "from-teal-400 to-cyan-500" },
    { value: 2, label: "Más de la mitad de los días", emoji: "😟", color: "from-yellow-400 to-orange-500" },
    { value: 3, label: "Casi todos los días", emoji: "😢", color: "from-red-400 to-pink-500" },
  ];

  const isLast = currentQuestion === questions.length - 1;
  const isNextDisabled = answers[currentQuestion] === null || isSubmitting;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} transition-all duration-1000 p-4 md:p-6 relative`}>
      {/* ✅ FaceMonitor diferido */}
      {enableFace && <FaceMonitor isActive={true} />}

      {/* Modales */}
      <AnimatePresence>
        {showModal && <Modal {...modalConfig} onClose={closeModal} />}

        {showExitConfirm && (
          <Modal
            type="warning"
            title="¿Salir del test?"
            message="Si sales ahora, perderás tu progreso actual. ¿Estás seguro de que quieres salir?"
            showCancel={true}
            onConfirm={() => navigate("/home")}
            onClose={() => setShowExitConfirm(false)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleExit}
            disabled={isSubmitting}
            className={`font-medium flex items-center gap-2 transition-colors hover:scale-105 drop-shadow ${
              isSubmitting ? "text-white/40 cursor-not-allowed" : "text-white/90 hover:text-white"
            }`}
          >
            <span className="text-2xl">←</span>
            <span>Salir</span>
          </button>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg"
          >
            GAD-7
          </motion.div>
        </div>

        {/* Card principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-6 md:p-8"
        >
          {/* Progreso */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-semibold text-gray-700">
                Pregunta {currentQuestion + 1} de {questions.length}
              </span>
              <span className="text-sm font-medium text-teal-600">
                {Math.round(progress)}%
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-teal-500 via-green-500 to-emerald-500 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            <div className="flex justify-between gap-1">
              {questions.map((_, index) => (
                <motion.div
                  key={index}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                    index < currentQuestion
                      ? "bg-green-500"
                      : index === currentQuestion
                      ? "bg-teal-500 shadow-lg"
                      : "bg-gray-300"
                  }`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.05 }}
                />
              ))}
            </div>
          </div>

          {/* Pregunta */}
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border-2 border-teal-100">
              <p className="text-sm text-gray-600 mb-3 font-medium">
                Durante las últimas dos semanas, ¿con qué frecuencia has sentido...?
              </p>

              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800 leading-snug">
                    {questions[currentQuestion]}
                  </h2>
                </div>

                <button
                  onClick={speakQuestion}
                  disabled={isSpeaking || isSubmitting}
                  className={`flex-shrink-0 p-3 rounded-full transition-all ${
                    isSpeaking || isSubmitting
                      ? "bg-teal-400 scale-110 animate-pulse"
                      : "bg-teal-500 hover:bg-teal-600 hover:scale-110 shadow-md"
                  }`}
                  title="Escuchar pregunta"
                >
                  <span className="text-2xl">{isSpeaking ? "🔊" : "🔉"}</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Opciones */}
          <div className="space-y-3 mb-6">
            {answerOptions.map((option, index) => (
              <motion.button
                key={option.value}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => !isSubmitting && handleClickAnswer(option.value)}
                disabled={isSubmitting}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-300 flex items-center justify-between group ${
                  answers[currentQuestion] === option.value
                    ? "border-teal-500 bg-gradient-to-r " +
                      option.color +
                      " text-white shadow-lg scale-[1.02]"
                    : "border-gray-200 hover:border-teal-300 hover:bg-gray-50 hover:scale-[1.01]"
                } ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{option.emoji}</span>
                  <span
                    className={`font-semibold ${
                      answers[currentQuestion] === option.value
                        ? "text-white"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </span>
                </div>

                <div
                  className={`text-2xl font-bold ${
                    answers[currentQuestion] === option.value
                      ? "text-white"
                      : "text-gray-400 group-hover:text-gray-600"
                  }`}
                >
                  {option.value}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Voz */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border-2 border-emerald-200">
              <AnimatePresence mode="wait">
                {!showVoiceConfirm ? (
                  <motion.div
                    key="listen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🎙️</span>
                        <p className="text-sm font-bold text-emerald-900">
                          O responde con tu voz
                        </p>
                      </div>
                      <p className="text-xs text-emerald-700 mb-2">
                        Haz clic en el micrófono y di tu respuesta en voz alta.
                      </p>

                      {voiceTranscript && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-emerald-800 italic bg-white/60 px-3 py-2 rounded-lg"
                        >
                          {voiceTranscript}
                        </motion.p>
                      )}
                    </div>

                    <button
                      onClick={startVoiceRecognition}
                      disabled={isListening || isSubmitting}
                      className={`flex-shrink-0 p-4 rounded-full transition-all shadow-lg ${
                        isListening && !isSubmitting
                          ? "bg-red-500 animate-pulse scale-110"
                          : "bg-emerald-500 hover:bg-emerald-600 hover:scale-110"
                      } ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""} text-white`}
                    >
                      <span className="text-2xl">{isListening ? "🎤" : "🎙️"}</span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="space-y-4"
                  >
                    <div className="bg-white/80 rounded-xl p-4 border-2 border-emerald-300">
                      <p className="text-sm text-gray-600 mb-2">
                        Tu respuesta detectada:
                      </p>
                      <p className="text-lg font-bold text-emerald-900">
                        {detectedAnswer.score} - {detectedAnswer.label}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={confirmVoiceAnswer}
                        disabled={isSubmitting}
                        className={`flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 ${
                          isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        <span>✓</span> Confirmar
                      </button>

                      <button
                        onClick={retryVoice}
                        disabled={isSubmitting}
                        className={`flex-1 px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 ${
                          isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        <span>🔄</span> Repetir
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navegación */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <button
              onClick={handlePrevious}
              disabled={currentQuestion === 0 || isSubmitting}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                currentQuestion === 0 || isSubmitting
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700 hover:shadow-md hover:scale-105"
              }`}
            >
              <span>←</span> Anterior
            </button>

            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                isNextDisabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105"
              }`}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  Guardando...
                  <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></span>
                </span>
              ) : (
                <>
                  {isLast ? "Finalizar" : "Siguiente"} <span>→</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default GAD7;
