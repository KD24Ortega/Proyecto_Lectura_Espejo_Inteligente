import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";

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

  // ✅ NUEVO: Estados para verificar tests
  const [isFirstEver, setIsFirstEver] = useState(false); // Primera vez haciendo tests
  const [needsOtherTest, setNeedsOtherTest] = useState(false); // Necesita hacer el otro test de esta sesión
  const [checkingTests, setCheckingTests] = useState(true);

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
        setNextTest("PHQ-9");
        setEstimatedTime("3 minutos");
      }

      // Configurar etiqueta y color según severidad
      configureSeverity(state.severity, state.type);
      
      // ✅ Verificar estado de tests
      checkTestStatus(state.type);
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
          setNextTest("PHQ-9");
          setEstimatedTime("3 minutos");
        }

        configureSeverity(lastSeverity, lastType);
        checkTestStatus(lastType);
      } else {
        // No hay datos, regresar al home
        navigate("/home");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigate]);

  // ============================================
  // VERIFICAR ESTADO DE LOS TESTS
  // ============================================
  const checkTestStatus = async (currentTestType) => {
    try {
      const userId = localStorage.getItem("user_id");
      
      if (!userId) {
        setCheckingTests(false);
        return;
      }

      // Obtener tests previos del usuario
      const response = await api.get(`/assessments/last/${userId}`);
      
      const hasPhq9Ever = response.data.phq9 && response.data.phq9.score !== null;
      const hasGad7Ever = response.data.gad7 && response.data.gad7.score !== null;

      // ✅ Verificar si los tests son de HOY
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      let phq9Today = false;
      let gad7Today = false;
      
      if (hasPhq9Ever && response.data.phq9.timestamp) {
        const phq9Date = new Date(response.data.phq9.timestamp).toISOString().split('T')[0];
        phq9Today = phq9Date === today;
      }
      
      if (hasGad7Ever && response.data.gad7.timestamp) {
        const gad7Date = new Date(response.data.gad7.timestamp).toISOString().split('T')[0];
        gad7Today = gad7Date === today;
      }

      // ✅ LÓGICA CORRECTA:
      if (currentTestType === "phq9") {
        // Acaba de completar PHQ-9
        
        if (!hasGad7Ever) {
          // NO tiene GAD-7 NUNCA → OBLIGATORIO hacer GAD-7
          setIsFirstEver(true);
          setNeedsOtherTest(true);
        } else {
          // Ya tiene GAD-7 previo → Verificar si lo hizo HOY
          setIsFirstEver(false);
          
          if (!gad7Today) {
            // No lo hizo hoy → SUGERIR (opcional)
            setNeedsOtherTest(true);
          } else {
            // Ya lo hizo hoy → Ya completó ambos
            setNeedsOtherTest(false);
          }
        }
        
      } else if (currentTestType === "gad7") {
        // Acaba de completar GAD-7
        
        if (!hasPhq9Ever) {
          // NO tiene PHQ-9 NUNCA → OBLIGATORIO hacer PHQ-9
          setIsFirstEver(true);
          setNeedsOtherTest(true);
        } else {
          // Ya tiene PHQ-9 previo → Verificar si lo hizo HOY
          setIsFirstEver(false);
          
          if (!phq9Today) {
            // No lo hizo hoy → SUGERIR (opcional)
            setNeedsOtherTest(true);
          } else {
            // Ya lo hizo hoy → Ya completó ambos
            setNeedsOtherTest(false);
          }
        }
      }

      setCheckingTests(false);
      
    } catch (error) {
      console.error("Error al verificar estado de tests:", error);
      setIsFirstEver(false);
      setNeedsOtherTest(false);
      setCheckingTests(false);
    }
  };

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
      navigate("/phq9");
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

  // ============================================
  // LOADING
  // ============================================
  if (checkingTests) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
        <div className="bg-white/85 backdrop-blur-md rounded-ui-lg shadow-card p-8 border border-white/60 text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-800 font-medium">Verificando progreso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4 transition-all duration-1000`}>
      {/* ✅ Reconocimiento facial activo en resultados */}
      <FaceMonitor isActive={true} />

      <div className="max-w-md w-full">
        {/* Numero 1: Titulo de completado */}
        <div className="bg-white/85 backdrop-blur-md rounded-ui-lg shadow-card p-6 mb-6 border border-white/60">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2">¡BIEN!</h1>
            <p className="text-gray-800 text-lg">Has completado la evaluación</p>
            <p className="text-gray-900 font-semibold text-xl mt-1">{getTestName()}</p>
          </div>
        </div>

        {/* Numero 2: Card de Resultados */}
        <div className="bg-white rounded-ui-lg shadow-elevated p-8 mb-6 border-4 border-blue-400">
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

        {/* ============================================
            CASO 1: PRIMERA VEZ ABSOLUTA
            ============================================ */}
        {isFirstEver && (
          <>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-ui-lg p-5 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-blue-900 font-semibold mb-1">
                    Un paso más para completar tu perfil
                  </p>
                  <p className="text-blue-700 text-sm">
                    Para establecer tu línea base emocional, necesitas completar el test {nextTest}.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-ui-sm font-bold text-lg transition-all hover:shadow-elevated flex items-center justify-center gap-2"
            >
              Continuar con {nextTest} <span>→</span>
            </button>

            <div className="text-center mt-4">
              <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
                <span>⏱️</span>
                <span>Tiempo estimado: {estimatedTime}</span>
              </div>
            </div>
          </>
        )}

        {/* ============================================
            CASO 2: NO ES PRIMERA VEZ - NECESITA HACER EL OTRO TEST
            ============================================ */}
        {!isFirstEver && needsOtherTest && (
          <>
            <div className="bg-white/85 backdrop-blur-md rounded-ui-md shadow-card p-6 mb-6 border border-white/60">
              <div className="text-center">
                <p className="text-gray-900 text-base mb-1 font-medium">
                  ¿Quieres completar tu evaluación de hoy?
                </p>
                <p className="text-gray-700 text-sm">
                  ({nextTest} - {testType === "phq9" ? "7" : "9"} preguntas)
                </p>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <button
                onClick={handleTakeBreak}
                className="flex-1 px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-ui-sm font-semibold transition-all hover:shadow-elevated"
              >
                Tomar un descanso
              </button>

              <button
                onClick={handleContinue}
                className={`flex-1 px-6 py-4 ${
                  testType === "phq9"
                    ? "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
                    : "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700"
                } text-white rounded-ui-sm font-semibold transition-all hover:shadow-elevated flex items-center justify-center gap-2`}
              >
                Continuar <span>→</span>
              </button>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-gray-700 text-sm bg-white/70 backdrop-blur rounded-full px-4 py-2 shadow-card border border-white/60">
                <span>⏱️</span>
                <span>Tiempo estimado: {estimatedTime}</span>
              </div>
            </div>
          </>
        )}

        {/* ============================================
            CASO 3: YA COMPLETÓ AMBOS TESTS
            ============================================ */}
        {!isFirstEver && !needsOtherTest && (
          <>
            <div className="bg-green-50 border-2 border-green-200 rounded-ui-lg p-5 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <p className="text-green-900 font-semibold mb-1">
                    ¡Evaluacion completa!
                  </p>
                  <p className="text-green-700 text-sm">
                    Listo!. Puedes ver tu progreso en el dashboard.
                  </p>
                  <p className="text-green-700 text-sm mt-2">
                    Te recomendamos realizar el siguiente test, si aun no lo has hecho el dia de hoy 😀.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => navigate("/home")}
                className="flex-1 px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-ui-sm font-semibold transition-all hover:shadow-elevated"
              >
                Ir al inicio
              </button>

              <button
                onClick={() => navigate("/dashboard")}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-ui-sm font-semibold transition-all hover:shadow-elevated"
              >
                Ver Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Results;