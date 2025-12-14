import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FaceMonitor from "../components/FaceMonitor";

// ✅ Hook
import useDynamicTheme from "../hooks/useDynamicTheme";

function DepressionExercises() {
  const navigate = useNavigate();

  // ✅ THEME dinámico (hook centralizado)
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg =
    theme?.colors?.primary || "from-amber-100 via-yellow-100 to-orange-100";

  const exercises = [
    {
      id: "prosodic-reading",
      title: "Lectura Prosódica",
      description:
        "Ejercicios de lectura con pausas y entonación para mejorar la expresión vocal",
      icon: "📄",
      color: "from-amber-400 to-orange-500",
      bgColor: "from-amber-50 to-orange-50",
      borderColor: "border-amber-300",
      hoverBorder: "hover:border-amber-500",
      details: [
        "Texto con pausas gráficas",
        "Indicadores de pausas largas y cortas",
        "Guía de entonación",
        "Medidor de expresividad vocal",
      ],
    },
    {
      id: "vocal-affirmations",
      title: "Afirmación Vocal Dirigida",
      description:
        "Frases positivas para fortalecer tu autoestima y confianza personal",
      icon: "💬",
      color: "from-teal-400 to-cyan-500",
      bgColor: "from-teal-50 to-cyan-50",
      borderColor: "border-teal-300",
      hoverBorder: "hover:border-teal-500",
      details: [
        "Banco de frases positivas",
        '"Soy capaz de manejar esto"',
        "Reproducción guiada",
        "Contador de repeticiones",
      ],
    },
    {
      id: "guided-dialogue",
      title: "Diálogo Guiado",
      description:
        "Preguntas reflexivas para conectar con tus emociones y pensamientos positivos",
      icon: "👥",
      color: "from-orange-400 to-rose-500",
      bgColor: "from-orange-50 to-rose-50",
      borderColor: "border-orange-300",
      hoverBorder: "hover:border-orange-500",
      details: [
        "Preguntas reflexivas diarias",
        "¿Qué agradeces hoy?",
        "Respuesta por voz",
        "Registro de conversaciones",
      ],
    },
  ];

  // =========================
  // LOADING (YA NO BLANCO)
  // =========================
  if (isThemeLoading) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6 transition-all duration-1000`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-white drop-shadow-lg">
            Cargando ejercicios...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${bg} p-6 transition-all duration-1000 relative`}
    >
      {/* Reconocimiento por cámara (monitor continuo oculto) */}
      <FaceMonitor isActive={true} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/home")}
            className="mb-4 flex items-center gap-2 text-amber-600 hover:text-amber-800 font-medium transition"
          >
            <span className="text-xl">←</span>
            <span>Volver al inicio</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">❤️</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Ejercicios para Depresión
                </h1>
                <p className="text-gray-600">
                  Técnicas de voz y lectura para elevar tu estado de ánimo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de ejercicios */}
        <div className="space-y-6">
          {exercises.map((exercise, index) => (
            <motion.button
              key={exercise.id}
              onClick={() => navigate(`/depression/${exercise.id}`)}
              className={`w-full bg-gradient-to-br ${exercise.bgColor} rounded-2xl p-6 border-3 ${exercise.borderColor} ${exercise.hoverBorder} hover:shadow-2xl transition-all duration-300 text-left group`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-6">
                {/* Icono */}
                <div
                  className={`w-20 h-20 bg-gradient-to-br ${exercise.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <span className="text-4xl">{exercise.icon}</span>
                </div>

                {/* Contenido */}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {exercise.title}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {exercise.description}
                  </p>

                  {/* Características sin viñetas */}
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    {exercise.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flecha */}
                <div className="flex items-center">
                  <span className="text-4xl text-amber-500 group-hover:translate-x-2 transition-transform">
                    →
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Información adicional */}
        <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="text-3xl flex-shrink-0">💡</span>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">
                ¿Cómo funcionan estos ejercicios?
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Cada ejercicio utiliza análisis de voz en tiempo real para evaluar
                tu tono, energía y estado emocional, brindándote retroalimentación
                personalizada. Los ejercicios duran entre 3-5 minutos.
              </p>
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <strong className="text-amber-800">Recomendación:</strong>{" "}
                  Practica estos ejercicios por la mañana para comenzar el día con
                  energía positiva, o cuando sientas que tu ánimo está bajo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg">
            <span className="text-2xl">🎯</span>
            <span className="text-sm text-gray-700">
              <strong>3 ejercicios</strong> disponibles para mejorar el ánimo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DepressionExercises;
