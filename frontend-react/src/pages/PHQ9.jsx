import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import FaceMonitor from "../components/FaceMonitor";
import UnifiedModal from "../components/UnifiedModal";
import { notifyConnectionError, notifySuccess } from "../utils/toast";

// ✅ Fallback STT (Vosk en backend)
import { recordAudioBlob } from "../utils/voskFallback";

// ✅ Hook de theme dinámico
import useDynamicTheme from "../hooks/useDynamicTheme";

function PHQ9() {
  const navigate = useNavigate();

  // ✅ Theme dinámico (hook centralizado)
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg = theme?.colors?.primary || "from-blue-100 via-purple-100 to-pink-100";

  // Estados principales
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ NUEVO: Verificar si es primera vez
  const [isFirstTest, setIsFirstTest] = useState(false);
  const [checkingFirstTest, setCheckingFirstTest] = useState(true);

  // ✅ evita doble envío
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ evita doble click en "Siguiente" (avance de pregunta)
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    setIsAdvancing(false);
  }, [currentQuestion]);

  // Estados de voz - Text to Speech
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Estados de voz - Speech to Text
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showVoiceConfirm, setShowVoiceConfirm] = useState(false);
  const [detectedAnswer, setDetectedAnswer] = useState(null);

  // ✅ Modo voz continuo (responder todas las preguntas sin presionar cada vez)
  const [voiceAutoMode, setVoiceAutoMode] = useState(false);

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
  const currentQuestionRef = useRef(0);
  const answersRef = useRef([]);
  const questionsRef = useRef([]);
  const voiceAutoModeRef = useRef(false);
  const voiceRequestIdRef = useRef(0);
  const activeVoiceRequestIdRef = useRef(0);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    voiceAutoModeRef.current = voiceAutoMode;
  }, [voiceAutoMode]);

  const runVoskFallback = async () => {
    const requestId = ++voiceRequestIdRef.current;
    activeVoiceRequestIdRef.current = requestId;
    try {
      setIsListening(true);
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
      setVoiceTranscript("Grabando audio...");

      const audioBlob = await recordAudioBlob({ seconds: 4 });
      setVoiceTranscript("Transcribiendo...");

      const fd = new FormData();
      fd.append("file", audioBlob, "speech.webm");

      const tr = await api.post("/voice/transcribe", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (requestId !== activeVoiceRequestIdRef.current) return;

      const transcript = (tr.data?.text || "").trim();
      if (!transcript) {
        setVoiceTranscript("No entendí. Intenta de nuevo.");
        return;
      }

      setVoiceTranscript(`Escuché: "${transcript}"`);

      const response = await api.post(
        `/voice/map-response?text=${encodeURIComponent(transcript)}`
      );

      if (requestId !== activeVoiceRequestIdRef.current) return;

      const score = response.data.score;

      const answerLabels = [
        "Ningún día",
        "Varios días",
        "Más de la mitad de los días",
        "Casi todos los días",
      ];

      handleVoiceScore({ transcript, score, answerLabels });
    } catch (error) {
      console.error("Fallback Vosk error:", error);
      setVoiceTranscript("Error al escuchar. Intenta de nuevo.");
    } finally {
      setIsListening(false);
    }
  };

  const stopVoiceAutoMode = () => {
    setVoiceAutoMode(false);
    // Invalida cualquier request en curso
    activeVoiceRequestIdRef.current = ++voiceRequestIdRef.current;
    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
    } catch {
      // noop
    }
    setIsListening(false);
  };

  const handleVoiceScore = ({ transcript, score, answerLabels }) => {
    // Si el usuario detuvo mientras procesábamos, ignorar.
    if (!voiceAutoModeRef.current && !showVoiceConfirm) {
      // noop
    }

    setVoiceTranscript(`Escuché: "${transcript}"`);

    if (voiceAutoModeRef.current) {
      const idx = currentQuestionRef.current;
      const finalAnswers = Array.isArray(answersRef.current)
        ? [...answersRef.current]
        : [];
      finalAnswers[idx] = score;
      answersRef.current = finalAnswers;
      setAnswers(finalAnswers);

      setShowVoiceConfirm(false);
      setDetectedAnswer(null);

      window.setTimeout(() => {
        if (!voiceAutoModeRef.current) return;
        const qs = questionsRef.current || [];
        if (idx < qs.length - 1) {
          setCurrentQuestion((prev) => prev + 1);
          setVoiceTranscript("");
        } else {
          submitTest(finalAnswers);
        }
      }, 350);

      return;
    }

    setDetectedAnswer({ score, label: answerLabels[score] });
    setShowVoiceConfirm(true);
  };

  // ✅ opcional: evita que FaceMonitor frene el primer render
  const [enableFace, setEnableFace] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnableFace(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    checkIfFirstTest();
    loadQuestions();
    initSpeechRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // VERIFICAR SI ES PRIMERA VEZ
  // ============================================
  const checkIfFirstTest = async () => {
    try {
      const userId = localStorage.getItem("user_id");
      
      if (!userId) {
        setIsFirstTest(false);
        setCheckingFirstTest(false);
        return;
      }

      // Verificar si el usuario tiene PHQ-9 previo
      const response = await api.get(`/assessments/last/${userId}`);
      
      // ✅ Solo verificar si tiene PHQ-9 (no importa GAD-7)
      const hasPhq9 = response.data.phq9 && response.data.phq9.score !== null;
      
      setIsFirstTest(!hasPhq9); // Es primera vez si NO tiene PHQ-9
      setCheckingFirstTest(false);
      
    } catch (error) {
      console.error("Error al verificar primer test:", error);
      // Si hay error, asumir que NO es primera vez (permitir salir)
      setIsFirstTest(false);
      setCheckingFirstTest(false);
    }
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
      const response = await api.get("/phq9/questions");
      setQuestions(response.data.questions);
      setAnswers(new Array(response.data.questions.length).fill(null));
      setIsLoading(false);
    } catch (error) {
      console.error("Error al cargar preguntas:", error);
      notifyConnectionError(error, "Error de conexión");
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
        const requestId = activeVoiceRequestIdRef.current;
        const transcript = event.results[0][0].transcript;
        setVoiceTranscript(`Escuché: "${transcript}"`);

        try {
          const response = await api.post(
            `/voice/map-response?text=${encodeURIComponent(transcript)}`
          );

          if (requestId !== activeVoiceRequestIdRef.current) return;

          const score = response.data.score;

          const answerLabels = [
            "Ningún día",
            "Varios días",
            "Más de la mitad de los días",
            "Casi todos los días",
          ];

          handleVoiceScore({ transcript, score, answerLabels });
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

          // Si el error es de servicio/red del SpeechRecognition, intentar fallback con Vosk.
          if (event.error === "network" || event.error === "service-not-allowed" || event.error === "service-not-available") {
            runVoskFallback();
          }
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
    const requestId = ++voiceRequestIdRef.current;
    activeVoiceRequestIdRef.current = requestId;

    if (!recognitionRef.current) {
      // Fallback automático a Vosk (backend)
      runVoskFallback();
      return;
    }

    try {
      setVoiceTranscript("");
      recognitionRef.current.start();
    } catch (error) {
      console.error("Error al iniciar reconocimiento:", error);
      // Si falla iniciar SpeechRecognition, intentar fallback.
      runVoskFallback();
    }
  };

  // ============================================
  // MANEJO DE RESPUESTAS
  // ============================================
  const handleClickAnswer = (value) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
    answersRef.current = newAnswers;

    setVoiceTranscript("");
    setShowVoiceConfirm(false);
    setDetectedAnswer(null);
  };

  const confirmVoiceAnswer = () => {
    if (detectedAnswer !== null) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = detectedAnswer.score;
      setAnswers(newAnswers);
      answersRef.current = newAnswers;

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
    if (isAdvancing) return;

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
      setIsAdvancing(true);
      setCurrentQuestion(currentQuestion + 1);
      setVoiceTranscript("");
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
    } else {
      submitTest();
    }
  };

  const handlePrevious = () => {
    if (isSubmitting) return;
    if (isAdvancing) return;

    if (currentQuestion > 0) {
      setIsAdvancing(true);
      setCurrentQuestion(currentQuestion - 1);
      setVoiceTranscript("");
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
    }
  };

  const handleExit = () => {
    if (isSubmitting) return;
    
    // ✅ NUEVO: Si es primera vez, mostrar mensaje especial
    if (isFirstTest) {
      showModalMessage({
        type: "info",
        title: "Test obligatorio",
        message:
          "Este es tu primer test y es necesario completarlo para establecer tu línea base emocional. Por favor, continúa respondiendo las preguntas.",
        onConfirm: closeModal,
      });
      return;
    }
    
    setShowExitConfirm(true);
  };

  // ============================================
  // ENVÍO DEL TEST
  // ============================================
  const submitTest = async (responsesOverride) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const userId = localStorage.getItem("user_id") || 1;

      const responsesToSend = responsesOverride ?? answers;

      const response = await api.post("/phq9/submit", {
        user_id: parseInt(userId),
        responses: responsesToSend,
      });

      localStorage.setItem("last_test_type", "phq9");
      localStorage.setItem("last_phq9_score", response.data.score);
      localStorage.setItem("last_phq9_severity", response.data.severity);

      notifySuccess("Evaluación completada");

      navigate("/results", {
        state: {
          type: "phq9",
          score: response.data.score,
          severity: response.data.severity,
        },
      });
    } catch (error) {
      console.error("Error al enviar test:", error);
      notifyConnectionError(error, "Error de conexión");
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

  // Auto-iniciar escucha en cada pregunta cuando el modo continuo está activo
  useEffect(() => {
    if (!voiceAutoMode) return;
    if (isSubmitting) return;
    if (isListening) return;
    if (showVoiceConfirm) return;
    if (answers[currentQuestion] !== null) return;

    const t = window.setTimeout(() => {
      if (!voiceAutoModeRef.current) return;
      startVoiceRecognition();
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceAutoMode, currentQuestion]);

  // ============================================
  // LOADING (theme + preguntas + verificación)
  // ============================================
  if (isThemeLoading || isLoading || checkingFirstTest) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bg}`}
      >
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
          <p className="text-2xl font-semibold text-white/90">
            Cargando test...
          </p>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const answerOptions = [
    { value: 0, label: "Ningún día", emoji: "😊", color: "from-green-400 to-emerald-500" },
    { value: 1, label: "Varios días", emoji: "😐", color: "from-blue-400 to-cyan-500" },
    { value: 2, label: "Más de la mitad de los días", emoji: "😟", color: "from-yellow-400 to-orange-500" },
    { value: 3, label: "Casi todos los días", emoji: "😢", color: "from-red-400 to-pink-500" },
  ];

  const isLast = currentQuestion === questions.length - 1;
  const isNextDisabled = answers[currentQuestion] === null || isSubmitting || isAdvancing;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-4 md:p-6 transition-all duration-1000`}>
      {enableFace && <FaceMonitor isActive={true} />}

      <AnimatePresence>
        <UnifiedModal
          isOpen={showModal}
          variant={modalConfig.type}
          title={modalConfig.title}
          message={modalConfig.message}
          onClose={closeModal}
          primaryAction={{
            label: modalConfig.showCancel ? "Confirmar" : "Aceptar",
            onClick: modalConfig.onConfirm || closeModal,
          }}
          secondaryAction={
            modalConfig.showCancel
              ? { label: "Cancelar", onClick: closeModal }
              : null
          }
        />

        <UnifiedModal
          isOpen={showExitConfirm}
          variant="warning"
          title="¿Salir del test?"
          message="Si sales ahora, perderás tu progreso actual. ¿Estás seguro de que quieres salir?"
          onClose={() => setShowExitConfirm(false)}
          primaryAction={{
            label: "Confirmar",
            onClick: () => {
              setShowExitConfirm(false);
              navigate("/home");
            },
          }}
          secondaryAction={{
            label: "Cancelar",
            onClick: () => setShowExitConfirm(false),
          }}
        />
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          {/* ✅ NUEVO: Mostrar botón de salir solo si NO es primera vez */}
          {!isFirstTest ? (
            <button
              onClick={handleExit}
              disabled={isSubmitting}
              className={`font-medium flex items-center gap-2 transition-colors hover:scale-105 ${
                isSubmitting ? "text-white/40 cursor-not-allowed" : "text-white/90 hover:text-white"
              }`}
            >
              <span className="text-2xl">←</span>
              <span>Salir</span>
            </button>
          ) : (
            /* ✅ NUEVO: Si es primera vez, mostrar mensaje en lugar del botón */
            <div className="flex items-center gap-2 text-white/90">
              <span className="text-xl">📋</span>
              <span className="text-sm font-medium">Primer test - Obligatorio</span>
            </div>
          )}

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-card"
          >
            PHQ-9
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-ui-xl shadow-elevated p-6 md:p-8"
        >
          {/* Progreso */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-semibold text-gray-700">
                Pregunta {currentQuestion + 1} de {questions.length}
              </span>
              <span className="text-sm font-medium text-purple-600">
                {Math.round(progress)}%
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-3 rounded-full"
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
                      ? "bg-blue-500 shadow-card"
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
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-ui-lg p-5 border-2 border-blue-100">
              <p className="text-sm text-gray-600 mb-3 font-medium">
                Durante los últimos días, ¿con qué frecuencia has sentido...?
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
                      ? "bg-blue-400 scale-110 animate-pulse"
                      : "bg-blue-500 hover:bg-blue-600 hover:scale-110 shadow-card"
                  }`}
                  title="Escuchar pregunta"
                >
                  <span className="text-2xl">{isSpeaking ? "🔊" : "🔉"}</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Respuestas */}
          <div className="space-y-3 mb-6">
            {answerOptions.map((option, index) => (
              <motion.button
                key={option.value}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => !isSubmitting && handleClickAnswer(option.value)}
                disabled={isSubmitting}
                className={`w-full p-4 rounded-ui-md border-2 transition-all duration-300 flex items-center justify-between group ${
                  answers[currentQuestion] === option.value
                    ? "border-blue-500 bg-gradient-to-r " +
                      option.color +
                      " text-white shadow-elevated scale-[1.02]"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:scale-[1.01]"
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
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-ui-lg p-5 border-2 border-purple-200">
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
                        <p className="text-sm font-bold text-purple-900">
                          O responde con tu voz
                        </p>
                      </div>
                      <p className="text-xs text-purple-700 mb-2">
                        {voiceAutoMode
                          ? "Modo continuo activado: responde en voz alta y avanzaremos automáticamente."
                          : "Haz clic en el micrófono y di tu respuesta en voz alta."}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => (voiceAutoMode ? stopVoiceAutoMode() : setVoiceAutoMode(true))}
                          disabled={isSubmitting}
                          className={`px-3 py-2 rounded-ui-sm text-xs font-bold transition-all border-2 shadow-card ${
                            voiceAutoMode
                              ? "bg-red-500 hover:bg-red-600 text-white border-red-300"
                              : "bg-white/80 hover:bg-white text-purple-900 border-purple-200"
                          } ${isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02]"}`}
                        >
                          {voiceAutoMode ? "Detener modo continuo" : "Activar modo continuo"}
                        </button>
                      </div>

                      {voiceTranscript && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-purple-800 italic bg-white/60 px-3 py-2 rounded-ui-sm"
                        >
                          {voiceTranscript}
                        </motion.p>
                      )}
                    </div>

                    <button
                      onClick={startVoiceRecognition}
                      disabled={isListening || isSubmitting}
                      className={`flex-shrink-0 p-4 rounded-full transition-all shadow-card ${
                        isListening && !isSubmitting
                          ? "bg-red-500 animate-pulse scale-110"
                          : "bg-purple-500 hover:bg-purple-600 hover:scale-110"
                      } ${
                        isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                      } text-white`}
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
                    <div className="bg-white/80 rounded-ui-md p-4 border-2 border-purple-300">
                      <p className="text-sm text-gray-600 mb-2">
                        Tu respuesta detectada:
                      </p>
                      <p className="text-lg font-bold text-purple-900">
                        {detectedAnswer.score} - {detectedAnswer.label}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={confirmVoiceAnswer}
                        disabled={isSubmitting}
                        className={`flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-ui-sm font-semibold transition-all shadow-card hover:shadow-elevated hover:scale-105 flex items-center justify-center gap-2 ${
                          isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        <span>✓</span> Confirmar
                      </button>

                      <button
                        onClick={retryVoice}
                        disabled={isSubmitting}
                        className={`flex-1 px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-ui-sm font-semibold transition-all shadow-card hover:shadow-elevated hover:scale-105 flex items-center justify-center gap-2 ${
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
              disabled={currentQuestion === 0 || isSubmitting || isAdvancing}
              className={`px-6 py-3 rounded-ui-sm font-semibold transition-all flex items-center gap-2 ${
                currentQuestion === 0 || isSubmitting || isAdvancing
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700 hover:shadow-card hover:scale-105"
              }`}
            >
              <span>←</span> Anterior
            </button>

            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className={`px-8 py-3 rounded-ui-sm font-bold transition-all flex items-center gap-2 ${
                isNextDisabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-card hover:shadow-elevated hover:scale-105"
              }`}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  Guardando...
                  <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></span>
                </span>
              ) : isAdvancing ? (
                <span className="inline-flex items-center gap-2">
                  Avanzando...
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

export default PHQ9;