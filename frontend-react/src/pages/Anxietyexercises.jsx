import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FaceMonitor from "../components/FaceMonitor";

// ✅ Hook
import useDynamicTheme from "../hooks/useDynamicTheme";

function AnxietyExercises() {
  const navigate = useNavigate();

  // ✅ THEME dinámico (hook centralizado)
  const { theme, isThemeLoading } = useDynamicTheme();
  const bg =
    theme?.colors?.primary || "from-blue-100 via-cyan-100 to-teal-100";

  const exercises = [
    {
      id: "breathing-vocalization",
      title: "Respiración con Vocalización",
      description:
        "Técnica de respiración guiada con sonidos vocales para calmar tu sistema nervioso",
      icon: "🌬️",
      color: "from-blue-400 to-cyan-500",
      bgColor: "from-blue-50 to-cyan-50",
      borderColor: "border-blue-300",
      hoverBorder: "hover:border-blue-500",
      details: [
        "Inhalar 4 segundos",
        'Exhalar diciendo "mmm"',
        'Sostener "oooo" lo más posible',
        "Temporizador circular",
      ],
    },
    {
      id: "conscious-reading",
      title: "Lectura Consciente",
      description:
        "Frases tranquilizadoras que te ayudan a centrarte en el momento presente",
      icon: "📖",
      color: "from-purple-400 to-purple-600",
      bgColor: "from-purple-50 to-purple-100",
      borderColor: "border-purple-300",
      hoverBorder: "hover:border-purple-500",
      details: [
        "Frases rotativas cada 6 segundos",
        '"Mi cuerpo se relaja poco a poco"',
        '"Todo está bien en este momento"',
        "Detección de nivel de ansiedad",
      ],
    },
    {
      id: "vocal-practice",
      title: "Práctica Vocal",
      description:
        "Ejercicios de voz y canto para liberar tensión y activar energía positiva",
      icon: "🎤",
      color: "from-pink-400 to-rose-500",
      bgColor: "from-pink-50 to-rose-50",
      borderColor: "border-pink-300",
      hoverBorder: "hover:border-pink-500",
      details: [
        "Notación musical: Do → Re → Mi",
        "Emisión Vocal Energética (EVE)",
        "Secuencias rítmicas: Ha-Pa-Ta",
        "Contador de repeticiones",
      ],
    },
  ];

  // ✅ LOADING (ya con theme)
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
      {/* ✅ Reconocimiento por cámara */}
      <FaceMonitor isActive={true} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/home")}
            className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition"
          >
            <span className="text-xl">←</span>
            <span>Volver al inicio</span>
          </button>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">🧠</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Ejercicios para Ansiedad
                </h1>
                <p className="text-gray-600">
                  Técnicas de voz y respiración para calmar tu mente
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
              onClick={() => navigate(`/anxiety/${exercise.id}`)}
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

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    {exercise.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flecha */}
                <div className="flex items-center">
                  <span className="text-4xl text-blue-500 group-hover:translate-x-2 transition-transform">
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
                tu estado emocional y proporcionarte retroalimentación inmediata.
                Los ejercicios duran entre 5-15 minutos.
              </p>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <strong className="text-blue-800">Recomendación:</strong>{" "}
                  Realiza estos ejercicios en un lugar tranquilo, con buena
                  iluminación y sin interrupciones para obtener mejores resultados.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Badge de progreso */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg">
            <span className="text-2xl">🎯</span>
            <span className="text-sm text-gray-700">
              <strong>3 ejercicios</strong> disponibles para reducir ansiedad
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnxietyExercises;
