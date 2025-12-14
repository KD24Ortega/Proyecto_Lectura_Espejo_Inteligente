import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// ✅ Reconocimiento facial
import FaceMonitor from "../components/FaceMonitor";

// ✅ Fondo dinámico (hook)
import useDynamicTheme from "../hooks/useDynamicTheme";

function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Theme dinámico (mismo patrón que el resto)
  const { theme } = useDynamicTheme();

  const [testType, setTestType] = useState("");
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(27);
  const [severity, setSeverity] = useState("");
  const [severityLabel, setSeverityLabel] = useState("");
  const [severityColor, setSeverityColor] = useState("");
  const [nextTest, setNextTest] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("3 minutos");

  useEffect(() => {
    // Obtener datos del test desde location.state o localStorage
    const state = location.state;

    if (state) {
      setTestType(state.type);
      setScore(state.score);
      setSeverity(state.severity);

      if (state.type === "phq9") {
        setMaxScore(27);
        setNextTest("GAD-7");
        setEstimatedTime("3 minutos");
      } else if (state.type === "gad7") {
        setMaxScore(21);
        setNextTest("");
        setEstimatedTime("");
      }

      // Configurar etiqueta y color según severidad
      configureSeverity(state.severity, state.type);
    } else {
      // Intentar recuperar de localStorage
      const lastType = localStorage.getItem("last_test_type");
      const lastScore = localStorage.getItem(`last_${lastType}_score`);
      const lastSeverity = localStorage.getItem(`last_${lastType}_severity`);

      if (lastType && lastScore && lastSeverity) {
        setTestType(lastType);
        setScore(parseInt(lastScore, 10));
        setSeverity(lastSeverity);

        if (lastType === "phq9") {
          setMaxScore(27);
          setNextTest("GAD-7");
          setEstimatedTime("3 minutos");
        } else {
          setMaxScore(21);
          setNextTest("");
          setEstimatedTime("");
        }

        configureSeverity(lastSeverity, lastType);
      } else {
        // No hay datos, regresar al home
        navigate("/home");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigate]);

  const configureSeverity = (sev, type) => {
    const severityConfig = {
      phq9: {
        minima: {
          label: "Depresion minima",
          color: "from-green-50 to-emerald-50",
          textColor: "text-green-800",
          emoji: "😊",
        },
        leve: {
          label: "Depresion leve",
          color: "from-yellow-50 to-amber-50",
          textColor: "text-yellow-800",
          emoji: "😐",
        },
        moderada: {
          label: "Depresion moderada",
          color: "from-orange-50 to-amber-50",
          textColor: "text-orange-800",
          emoji: "😟",
        },
        "moderadamente severa": {
          label: "Depresion moderadamente severa",
          color: "from-red-50 to-orange-50",
          textColor: "text-red-800",
          emoji: "😢",
        },
        severa: {
          label: "Depresion severa",
          color: "from-red-100 to-red-50",
          textColor: "text-red-900",
          emoji: "😰",
        },
      },
      gad7: {
        minima: {
          label: "Ansiedad minima",
          color: "from-green-50 to-emerald-50",
          textColor: "text-green-800",
          emoji: "😊",
        },
        leve: {
          label: "Ansiedad leve",
          color: "from-yellow-50 to-amber-50",
          textColor: "text-yellow-800",
          emoji: "😐",
        },
        moderada: {
          label: "Ansiedad moderada",
          color: "from-orange-50 to-amber-50",
          textColor: "text-orange-800",
          emoji: "😟",
        },
        severa: {
          label: "Ansiedad severa",
          color: "from-red-100 to-red-50",
          textColor: "text-red-900",
          emoji: "😰",
        },
      },
    };

    const config = severityConfig[type]?.[sev] || severityConfig[type]?.minima;

    setSeverityLabel(config.label);
    setSeverityColor(config.color);
  };

  const handleTakeBreak = () => {
    navigate("/home");
  };

  const handleContinue = () => {
    if (testType === "phq9") {
      navigate("/gad7");
    } else {
      navigate("/home");
    }
  };

  const getSeverityEmoji = () => {
    if (severity === "minima") return "😊";
    if (severity === "leve") return "😐";
    if (severity === "moderada") return "😟";
    if (severity === "moderadamente severa") return "😢";
    if (severity === "severa") return "😰";
    return "😊";
  };

  const getTestName = () => {
    return testType === "phq9" ? "PHQ-9" : "GAD-7";
  };

  // ✅ Fondo por defecto si el hook aún no devuelve theme (evita nulls)
  const bgClass = useMemo(() => {
    const primary = theme?.colors?.primary;
    if (primary) return `bg-gradient-to-br ${primary}`;
    return "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50";
  }, [theme]);

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4 transition-all duration-1000`}>
      {/* ✅ Reconocimiento facial activo en resultados */}
      <FaceMonitor isActive={true} />

      <div className="max-w-md w-full">
        {/* Numero 1: Titulo de completado */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">¡BIEN!</h1>
          <p className="text-gray-600 text-lg">Has completado la evaluacion</p>
          <p className="text-gray-700 font-semibold text-xl mt-1">
            {getTestName()}
          </p>
        </div>

        {/* Numero 2: Card de Resultados */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6 border-4 border-blue-400">
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-3">Tu puntuacion:</p>

            {/* Score grande */}
            <div className="mb-4">
              <span className="text-6xl font-bold text-blue-600">{score}</span>
              <span className="text-3xl text-gray-400 ml-2">/ {maxScore}</span>
            </div>

            {/* Badge de severidad */}
            <div
              className={`inline-block px-6 py-3 rounded-full bg-gradient-to-r ${severityColor} border-2 border-orange-300`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getSeverityEmoji()}</span>
                <span className="font-bold text-orange-800 capitalize">
                  {severityLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Numero 3: Pregunta para siguiente test */}
        {testType === "phq9" && (
          <div className="text-center mb-6">
            <p className="text-gray-700 text-base mb-1">
              ¿Listo para la evaluacion de ansiedad?
            </p>
            <p className="text-gray-500 text-sm">({nextTest} - 7 preguntas)</p>
          </div>
        )}

        {/* Numero 4 y 5: Botones de accion */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleTakeBreak}
            className="flex-1 px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all hover:shadow-lg"
          >
            Tomar un descanso
          </button>

          {testType === "phq9" && (
            <button
              onClick={handleContinue}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg flex items-center justify-center gap-2"
            >
              Continuar <span>→</span>
            </button>
          )}
        </div>

        {/* Numero 6: Tiempo estimado */}
        {testType === "phq9" && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
              <span>⏱️</span>
              <span>Tiempo estimado: {estimatedTime}</span>
            </div>
          </div>
        )}

        {/* Si es GAD-7, mostrar mensaje de finalizado */}
        {testType === "gad7" && (
          <div className="text-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg"
            >
              ✓ Finalizar y ver Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Results;
