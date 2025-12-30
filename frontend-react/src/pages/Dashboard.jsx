import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import FaceMonitor from "../components/FaceMonitor";
import BackgroundMusic from '../components/BackgroundMusic';
import useDynamicTheme from "../hooks/useDynamicTheme";
import UnifiedModal from "../components/UnifiedModal";

/* =====================================================
   CONSTANTES / HELPERS (fuera del componente)
===================================================== */
const DAYS_OPTIONS = [7, 30, 90];
const MAX_PHQ9 = 27;
const MAX_GAD7 = 21;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const safeUpper = (v) => (typeof v === "string" ? v.toUpperCase() : v);

const getMaxVoiceRiskLevel = (sessions) => {
  const arr = Array.isArray(sessions) ? sessions : [];
  if (!arr.length) return "LOW";

  const order = { LOW: 0, MODERATE: 1, HIGH: 2 };
  let max = "LOW";
  for (const s of arr) {
    const r = safeUpper(s?.risk_level) || "LOW";
    const rr = order[r] !== undefined ? r : "LOW";
    if (order[rr] > order[max]) max = rr;
  }
  return max;
};

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const buildXAxisLabels = (dates, target = 6) => {
  const arr = Array.isArray(dates) ? dates : [];
  if (!arr.length) return [];
  if (arr.length <= target) return arr;

  // puntos espaciados (incluye inicio y fin)
  const idxs = Array.from({ length: target }, (_, i) =>
    Math.round((i / (target - 1)) * (arr.length - 1))
  );

  const unique = [];
  const seen = new Set();
  for (const i of idxs) {
    if (!seen.has(i)) {
      unique.push(arr[i]);
      seen.add(i);
    }
  }
  return unique;
};

/* =====================================================
   MODAL DE INFO (memo para evitar re-render innecesario)
===================================================== */
const InfoModal = React.memo(function InfoModal({
  isOpen,
  onClose,
  title,
  content,
  icon,
}) {
  return (
    <UnifiedModal
      isOpen={isOpen}
      variant="info"
      title={title}
      icon={icon}
      onClose={onClose}
      size="lg"
      hideFooter={true}
    >
      {content}
    </UnifiedModal>
  );
});

/* =====================================================
   CONTENIDOS DE MODALES (fuera para no recrearlos)
===================================================== */
const INFO_CONTENTS = {
  multimodal: {
    title: "Puntuación Multimodal",
    icon: "🎯",
    render: () => (
      <div className="space-y-4">
        <p className="text-gray-700">
          La <strong>Puntuación Multimodal</strong> combina datos de múltiples
          fuentes para ofrecer una evaluación integral de tu bienestar mental:
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="font-bold text-blue-900 mb-2">📝 Tests (60%)</p>
            <p className="text-sm text-gray-700">
              PHQ-9 y GAD-7 evaluados por ti mismo
            </p>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <p className="font-bold text-purple-900 mb-2">🎤 Voz (40%)</p>
            <p className="text-sm text-gray-700">
              Análisis de biomarcadores vocales
            </p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5">
          <h4 className="font-bold text-indigo-900 mb-3">¿Por qué es mejor?</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Más preciso que evaluaciones individuales</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Detecta inconsistencias entre auto-reporte y voz</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Captura cambios que podrías no percibir</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  voice: {
    title: "Análisis de Voz",
    icon: "🎤",
    render: () => (
      <div className="space-y-4">
        <p className="text-gray-700">
          El análisis de voz evalúa biomarcadores acústicos que se correlacionan
          con estados emocionales y salud mental.
        </p>
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5">
          <h4 className="font-bold text-purple-900 mb-3">
            Biomarcadores medidos:
          </h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">F0</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">
                  Pitch (Tono fundamental)
                </p>
                <p className="text-gray-600">
                  Frecuencia de tu voz. Cambios pueden reflejar tu estado emocional.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">E</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Energía vocal</p>
                <p className="text-gray-600">
                  Intensidad de tu voz. Refleja tu vitalidad y estado de ánimo.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">HNR</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Calidad vocal (HNR)</p>
                <p className="text-gray-600">
                  Relación armónicos/ruido. Mide estabilidad emocional.
                </p>
              </div>
            </li>
          </ul>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>💡 Importante:</strong> Los análisis de voz son
            complementarios a las evaluaciones clínicas tradicionales, no las
            reemplazan.
          </p>
        </div>
      </div>
    ),
  },
  recommendations: {
    title: "Interpretación de Resultados",
    icon: "ℹ️",
    render: () => (
      <div className="space-y-4 text-gray-700">
        <p>
          Aquí estás viendo la evolución de <strong>PHQ-9</strong> (depresión) y{" "}
          <strong>GAD-7</strong> (ansiedad).
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="font-bold text-blue-900 mb-2">PHQ-9</p>
            <ul className="text-sm space-y-1">
              <li>• 0–4: mínima</li>
              <li>• 5–9: leve</li>
              <li>• 10–14: moderada</li>
              <li>• 15–27: severa</li>
            </ul>
          </div>
          <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-4">
            <p className="font-bold text-teal-900 mb-2">GAD-7</p>
            <ul className="text-sm space-y-1">
              <li>• 0–4: mínima</li>
              <li>• 5–9: leve</li>
              <li>• 10–14: moderada</li>
              <li>• 15–21: severa</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          ⚠️ Esto no es diagnóstico clínico. Es una guía orientativa basada en
          escalas psicométricas.
        </p>
      </div>
    ),
  },
};

/* =====================================================
   MENSAJE CLÍNICO (fuera, puro) - VERSIÓN POSITIVA Y ALENTADORA
===================================================== */
const getClinicalMessage = (result) => {
  const baseDisclaimer = (
    <p className="text-xs text-gray-600 mt-3">
      ⚠️ Este resultado no constituye un diagnóstico clínico y no reemplaza una
      evaluación profesional.
    </p>
  );

  switch (result) {
    case "DEPRESION_Y_ANSIEDAD_ALTA_PROB":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Se detectaron
            biomarcadores vocales que sugieren la importancia de brindarte apoyo emocional adicional.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> PHQ-9 y GAD-7 sugieren
            síntomas que merecen atención profesional.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Te animamos a buscar orientación profesional. 
            Pedir ayuda es un paso valiente hacia tu bienestar.
          </p>
          {baseDisclaimer}
        </>
      );

    case "DEPRESION_Y_ANSIEDAD_PROBABLE":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Los biomarcadores sugieren
            que podrías beneficiarte de apoyo adicional.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> PHQ-9 y GAD-7 ≥ 10.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Considera buscar acompañamiento profesional. 
            Cuidar de ti mismo es importante y mereces sentirte mejor.
          </p>
          {baseDisclaimer}
        </>
      );

    case "DEPRESION_Y_ANSIEDAD_EN_TESTS":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Tu voz muestra indicadores positivos.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> Los tests (PHQ-9 y GAD-7)
            reportan síntomas que vale la pena explorar.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Sería beneficioso conversar con un profesional
            para validar tus experiencias y encontrar estrategias de apoyo.
          </p>
          {baseDisclaimer}
        </>
      );

    case "DEPRESION_ALTA_PROB":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Se detectaron
            biomarcadores que indican la importancia de darte apoyo emocional.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> PHQ-9 ≥ 10, GAD-7 &lt; 10.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Te sugerimos buscar evaluación profesional. 
            Hay muchas herramientas disponibles para ayudarte a sentirte mejor.
          </p>
          {baseDisclaimer}
        </>
      );

    case "DEPRESION_PROBABLE":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Los biomarcadores sugieren
            que algunos cambios podrían ser beneficiosos.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> PHQ-9 ≥ 10.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Mantén hábitos de autocuidado y considera 
            buscar apoyo profesional si los síntomas persisten. Mereces sentirte bien.
          </p>
          {baseDisclaimer}
        </>
      );

    case "DEPRESION_EN_TESTS":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Tu voz muestra características positivas.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> PHQ-9 ≥ 10 (según tu auto-reporte).
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Si estos síntomas afectan tu día a día, 
            conversar con un profesional puede darte herramientas valiosas para mejorar.
          </p>
          {baseDisclaimer}
        </>
      );

    case "ANSIEDAD_ALTA_PROB":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Se detectaron
            biomarcadores que sugieren la importancia de técnicas de regulación emocional.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> GAD-7 ≥ 10, PHQ-9 &lt; 10.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Te animamos a buscar orientación profesional 
            para aprender estrategias efectivas de manejo emocional.
          </p>
          {baseDisclaimer}
        </>
      );

    case "ANSIEDAD_PROBABLE":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Los biomarcadores sugieren
            que podrías beneficiarte de técnicas de regulación.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> GAD-7 ≥ 10.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Practica técnicas de regulación emocional 
            y mantén seguimiento de tu progreso. Estás tomando pasos positivos.
          </p>
          {baseDisclaimer}
        </>
      );

    case "ANSIEDAD_EN_TESTS":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Tu voz muestra buena estabilidad.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> GAD-7 ≥ 10 (según tu auto-reporte).
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Si estos síntomas persisten, 
            buscar apoyo profesional puede ayudarte a desarrollar mejores estrategias de afrontamiento.
          </p>
          {baseDisclaimer}
        </>
      );

    case "RIESGO_VOCAL_ALTO_SIN_TESTS":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Tu voz muestra señales
            que vale la pena explorar más a fondo.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> Tests en rango favorable (PHQ-9 y GAD-7
            &lt; 10).
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Repite ejercicios y cuida factores como 
            sueño y estrés. Si persiste, conversa con un profesional para descartar causas físicas.
          </p>
          {baseDisclaimer}
        </>
      );

    case "RIESGO_EMOCIONAL_LEVE":
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> Se detectaron
            algunos indicadores leves que vale la pena monitorear.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> Tests en rango favorable
            (PHQ-9 y GAD-7 &lt; 10).
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> Mantén un seguimiento preventivo 
            y continúa con tus hábitos saludables. Vas por buen camino.
          </p>
          {baseDisclaimer}
        </>
      );

    case "SIN_INDICIOS":
    default:
      return (
        <>
          <p>
            <strong>Resultado del análisis vocal:</strong> No se detectaron
            patrones vocales de preocupación.
          </p>
          <p className="mt-2">
            <strong>Evaluación combinada:</strong> Los cuestionarios no sugieren
            alteraciones significativas.
          </p>
          <p className="mt-2">
            <strong>Recomendación:</strong> ¡Excelente! Continúa con tus hábitos saludables 
            y mantén este bienestar emocional.
          </p>
          {baseDisclaimer}
        </>
      );
  }
};

/* =====================================================
   DASHBOARD
===================================================== */
function Dashboard() {
  const navigate = useNavigate();

  const { theme } = useDynamicTheme();

  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [trendsData, setTrendsData] = useState(null);
  const [voiceData, setVoiceData] = useState(null);

  const [timeRange, setTimeRange] = useState(30);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [showInfo, setShowInfo] = useState(null);

  // ✅ Para evitar setState luego de un cambio rápido de timeRange
  const requestSeqRef = useRef(0);

  // ✅ Para no frenar el primer paint (FaceMonitor)
  const [enableFace, setEnableFace] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnableFace(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    const mySeq = ++requestSeqRef.current;

    try {
      const userId = localStorage.getItem("user_id");
      const name = localStorage.getItem("user_name");

      if (!userId) {
        navigate("/");
        return;
      }

      setUserName(name || "");

      // ✅ Cargar trends y voz en paralelo (mejor tiempo de render)
      const trendsPromise = api.get(`/trends/analyze/${userId}?days=${timeRange}`);
      const voicePromise = api
        .get(`/api/voice/user/${userId}/stats?days=${timeRange}`)
        .catch(() => null);

      const [trendsResponse, voiceResponse] = await Promise.all([
        trendsPromise,
        voicePromise,
      ]);

      // ✅ Si hubo otro request después, ignora este
      if (mySeq !== requestSeqRef.current) return;

      setTrendsData(trendsResponse?.data || null);
      setVoiceData(voiceResponse?.data || null);
    } catch (error) {
      if (mySeq !== requestSeqRef.current) return;
      console.error("Error al cargar dashboard:", error);
    } finally {
      if (mySeq === requestSeqRef.current) setIsLoading(false);
    }
  }, [navigate, timeRange]);

  const getMultimodalStatus = useCallback((score) => {
    if (score >= 80) return "excellent";
    if (score >= 65) return "good";
    if (score >= 45) return "moderate";
    if (score >= 30) return "needs_attention";
    return "needs_support";
  }, []);

  const getStatusText = useCallback((status) => {
    const texts = {
      excellent: "Excelente",
      good: "Bueno",
      moderate: "En progreso",
      needs_attention: "Necesita atención",
      needs_support: "Requiere apoyo",
    };
    return texts[status] || status;
  }, []);

  const getTrendIcon = useCallback((trend) => {
    if (trend === "improving")
      return { icon: "📈", text: "Mejorando", color: "text-green-600" };
    if (trend === "worsening")
      return { icon: "📊", text: "Requiere atención", color: "text-amber-600" };
    return { icon: "➡️", text: "Estable", color: "text-gray-600" };
  }, []);

  const showInfoModal = useCallback((type) => {
    const def = INFO_CONTENTS[type];
    if (!def) return;
    setShowInfo({
      title: def.title,
      icon: def.icon,
      content: def.render(),
    });
  }, []);

  // ===============================
  // DERIVADOS MEMO (evita cálculos en cada render)
  // ===============================
  const safePhq = trendsData?.phq9 || { scores: [], dates: [], trend: "stable" };
  const safeGad = trendsData?.gad7 || { scores: [], dates: [], trend: "stable" };

  const phq9Avg = useMemo(() => {
    const scores = safePhq.scores || [];
    if (!scores.length) return "0.0";
    const sum = scores.reduce((a, b) => safeNum(a) + safeNum(b), 0);
    return (sum / scores.length).toFixed(1);
  }, [safePhq.scores]);

  const gad7Avg = useMemo(() => {
    const scores = safeGad.scores || [];
    if (!scores.length) return "0.0";
    const sum = scores.reduce((a, b) => safeNum(a) + safeNum(b), 0);
    return (sum / scores.length).toFixed(1);
  }, [safeGad.scores]);

  const voiceSessions = useMemo(() => voiceData?.sessions || [], [voiceData]);

  const voiceAverages = useMemo(() => {
    if (!voiceSessions.length) return null;

    const pitch = voiceSessions.reduce((sum, s) => sum + safeNum(s?.pitch_mean, 0), 0) / voiceSessions.length;

    const energy =
      (voiceSessions.reduce((sum, s) => sum + safeNum(s?.energy, 0), 0) / voiceSessions.length) * 100;

    const hnr = voiceSessions.reduce((sum, s) => sum + safeNum(s?.hnr, 0), 0) / voiceSessions.length;

    return {
      pitch: pitch.toFixed(1),
      energy: energy.toFixed(1),
      hnr: hnr.toFixed(1),
    };
  }, [voiceSessions]);

  // Calcular distribución de indicadores vocales 1 sola vez
  const voiceIndicatorDistribution = useMemo(() => {
    const total = voiceSessions.length || 0;
    const levels = ["LOW", "MODERATE", "HIGH"];
    const counts = { LOW: 0, MODERATE: 0, HIGH: 0 };

    for (const s of voiceSessions) {
      const rl = safeUpper(s?.risk_level) || "LOW";
      if (counts[rl] !== undefined) counts[rl] += 1;
    }

    return levels.map((level) => {
      const count = counts[level] || 0;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return { level, count, percent };
    });
  }, [voiceSessions]);

  // Ejercicios más usados: precomputar
  const exerciseCounts = useMemo(() => {
    const map = new Map();
    for (const s of voiceSessions) {
      const id = s?.exercise_id;
      if (id === null || id === undefined) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [voiceSessions]);

  const calculateMultimodalScore = useCallback(() => {
    if (!trendsData) return null;

    const testsScore = safeNum(trendsData?.overall?.tests_score, 0);
    let voiceScore = 50; // neutral por defecto

    const hasSessions = !!voiceSessions.length;

    if (hasSessions) {
      const riskScores = voiceSessions.map((session) => {
        const r = safeUpper(session?.risk_level) || "LOW";
        if (r === "LOW") return 90;
        if (r === "MODERATE") return 60;
        if (r === "HIGH") return 30;
        return 50;
      });
      voiceScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    }

    const multimodalScore = testsScore * 0.6 + voiceScore * 0.4;

    return {
      total: Math.round(multimodalScore),
      testsScore: Math.round(testsScore),
      voiceScore: Math.round(voiceScore),
      status: getMultimodalStatus(multimodalScore),
      hasVoiceData: hasSessions,
    };
  }, [getMultimodalStatus, trendsData, voiceSessions]);

  const multimodal = useMemo(() => calculateMultimodalScore(), [calculateMultimodalScore]);

  // ===============================
  // ANÁLISIS MULTIMODAL CLÍNICO REAL
  // ===============================
  const voiceIndicator = useMemo(() => {
    if (!voiceSessions.length) return "LOW";
    const order = { LOW: 0, MODERATE: 1, HIGH: 2 };

    return voiceSessions.reduce((max, s) => {
      const r = safeUpper(s?.risk_level) || "LOW";
      const rr = order[r] !== undefined ? r : "LOW";
      return order[rr] > order[max] ? rr : max;
    }, "LOW");
  }, [voiceSessions]);

  const phqPositive = useMemo(() => safeNum(phq9Avg, 0) >= 10, [phq9Avg]);
  const gadPositive = useMemo(() => safeNum(gad7Avg, 0) >= 10, [gad7Avg]);

  const multimodalClinicalResult = useMemo(() => {
    if (phqPositive && gadPositive) {
      if (voiceIndicator === "HIGH") return "DEPRESION_Y_ANSIEDAD_ALTA_PROB";
      if (voiceIndicator === "MODERATE") return "DEPRESION_Y_ANSIEDAD_PROBABLE";
      return "DEPRESION_Y_ANSIEDAD_EN_TESTS";
    }

    if (phqPositive && !gadPositive) {
      if (voiceIndicator === "HIGH") return "DEPRESION_ALTA_PROB";
      if (voiceIndicator === "MODERATE") return "DEPRESION_PROBABLE";
      return "DEPRESION_EN_TESTS";
    }

    if (!phqPositive && gadPositive) {
      if (voiceIndicator === "HIGH") return "ANSIEDAD_ALTA_PROB";
      if (voiceIndicator === "MODERATE") return "ANSIEDAD_PROBABLE";
      return "ANSIEDAD_EN_TESTS";
    }

    if (!phqPositive && !gadPositive) {
      if (voiceIndicator === "HIGH") return "RIESGO_VOCAL_ALTO_SIN_TESTS";
      if (voiceIndicator === "MODERATE") return "RIESGO_EMOCIONAL_LEVE";
      return "SIN_INDICIOS";
    }

    return "SIN_INDICIOS";
  }, [phqPositive, gadPositive, voiceIndicator]);

  // ===============================
  // CHART: precálculo de puntos (mejor rendimiento)
  // ===============================
  const phqPoints = useMemo(() => {
    const scores = safePhq.scores || [];
    const n = scores.length;
    if (!n) return [];
    const denom = Math.max(n - 1, 1);
    return scores.map((score, index) => {
      const x = (index / denom) * 100;
      const y = 100 - (safeNum(score) / MAX_PHQ9) * 100;
      return { x, y, score: safeNum(score), index };
    });
  }, [safePhq.scores]);

  const gadPoints = useMemo(() => {
    const scores = safeGad.scores || [];
    const n = scores.length;
    if (!n) return [];
    const denom = Math.max(n - 1, 1);
    return scores.map((score, index) => {
      const x = (index / denom) * 100;
      const y = 100 - (safeNum(score) / MAX_GAD7) * 100;
      return { x, y, score: safeNum(score), index };
    });
  }, [safeGad.scores]);

  const phqPolyline = useMemo(() => phqPoints.map((p) => `${p.x},${p.y}`).join(" "), [phqPoints]);
  const gadPolyline = useMemo(() => gadPoints.map((p) => `${p.x},${p.y}`).join(" "), [gadPoints]);

  const phqPolygon = useMemo(() => {
    if (!phqPoints.length) return "";
    return `0,100 ${phqPoints.map((p) => `${p.x},${p.y}`).join(" ")} 100,100`;
  }, [phqPoints]);

  const gadPolygon = useMemo(() => {
    if (!gadPoints.length) return "";
    return `0,100 ${gadPoints.map((p) => `${p.x},${p.y}`).join(" ")} 100,100`;
  }, [gadPoints]);

  const phqXAxisLabels = useMemo(
    () => buildXAxisLabels(safePhq?.dates || [], 6),
    [safePhq?.dates]
  );

  const gadXAxisLabels = useMemo(
    () => buildXAxisLabels(safeGad?.dates || [], 6),
    [safeGad?.dates]
  );

  const handleHoverPoint = useCallback((payload) => {
    setHoveredPoint(payload);
  }, []);

  const clearHover = useCallback(() => setHoveredPoint(null), []);

  // ===============================
  // RENDER: LOADING / EMPTY
  // ===============================
  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme?.colors?.primary || "from-blue-200 via-purple-200 to-pink-200"} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin" />
          <p className="text-xl text-white/90 drop-shadow">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  const phqScores = safePhq.scores || [];
  const gadScores = safeGad.scores || [];

  if (!trendsData || (phqScores.length === 0 && gadScores.length === 0)) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme?.colors?.primary || "from-blue-200 via-purple-200 to-pink-200"} flex items-center justify-center p-6`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center"
        >
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            No hay datos suficientes
          </h2>
          <p className="text-gray-600 mb-6">
            Necesitas completar al menos una evaluación para ver tus estadísticas
          </p>
          <button
            onClick={() => navigate("/home")}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
          >
            Ir al Home
          </button>
        </motion.div>
      </div>
    );
  }

  // ===============================
  // Colores / textos (status)
  // ===============================
  const getStatusColor = (status) => {
    const colors = {
      excellent: "from-green-500 to-emerald-500",
      good: "from-blue-500 to-cyan-500",
      moderate: "from-yellow-500 to-orange-500",
      needs_attention: "from-orange-500 to-amber-600",
      needs_support: "from-amber-600 to-orange-700",
    };
    return colors[status] || "from-gray-500 to-gray-700";
  };

  // Mapeo de nombres de ejercicios
  const exerciseNames = {
    1: "Respiración",
    2: "Lectura",
    3: "Vocal",
    4: "Prosódica",
    5: "Afirmaciones",
    6: "Diálogo",
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme?.colors?.primary || "from-blue-200 via-purple-200 to-pink-200"} p-6 transition-all duration-1000`}>
      {/* ✅ FaceMonitor diferido para mejorar el primer render */}
      {enableFace && <FaceMonitor isActive={true} />}

      {/* Música de fondo */}
      <BackgroundMusic musicFile={theme.music} volume={0.2} />

      <InfoModal
        isOpen={showInfo !== null}
        onClose={() => setShowInfo(null)}
        title={showInfo?.title}
        icon={showInfo?.icon}
        content={showInfo?.content}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap justify-between items-center mb-8 gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
              📊 Mi Dashboard
            </h1>
            <p className="text-white/90 text-lg">
              Hola, <span className="font-semibold">{userName}</span> · Análisis
              de tus últimos {timeRange} días
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex gap-2 bg-white rounded-lg p-1 shadow-md">
              {DAYS_OPTIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    timeRange === days
                      ? "bg-blue-500 text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {days} días
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate("/home")}
              className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition shadow-md font-medium flex items-center gap-2"
            >
              <span>←</span>
              <span>Volver</span>
            </button>
          </div>
        </motion.div>

        {/* 🚨 Panel de emergencia (usa tools/emergencyNumber del tema) */}
        {theme?.emergency && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${theme?.colors?.card || "bg-red-50/95 border-4 border-red-500"} rounded-2xl shadow-xl p-6 mb-6`}
            role="alert"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className={`text-lg font-bold ${theme?.colors?.accent || "text-red-700"}`}>
                  {theme?.name || "🚨 ALTO RIESGO"}
                </p>
                <p className={`${theme?.colors?.text || "text-gray-900"} text-sm mt-1`}>
                  Si te sientes en peligro o necesitas ayuda inmediata, busca apoyo ahora.
                </p>
              </div>

              {theme?.emergencyNumber && (
                (() => {
                  const firstNumber = String(theme.emergencyNumber).match(/\d+/)?.[0];
                  const href = firstNumber ? `tel:${firstNumber}` : null;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Línea de ayuda</p>
                        <p className={`font-bold ${theme?.colors?.accent || "text-red-700"}`}>{theme.emergencyNumber}</p>
                      </div>
                      {href && (
                        <a
                          href={href}
                          className={`px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r ${theme?.colors?.button || "from-red-600 to-red-700"}`}
                        >
                          Llamar
                        </a>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {Array.isArray(theme?.tools) && theme.tools.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">Acciones sugeridas</p>
                <div className="flex flex-wrap gap-2">
                  {theme.tools.map((t, idx) => (
                    <span
                      key={`tool-${idx}`}
                      className="px-3 py-1 rounded-full bg-white/80 border border-gray-200 text-sm text-gray-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* SCORE MULTIMODAL */}
        {multimodal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-2xl p-8 mb-6 text-white"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  🎯 Evaluación Multimodal
                </h2>
                <p className="text-white/90">Combina análisis de tests y voz</p>
              </div>
              <button
                onClick={() => showInfoModal("multimodal")}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition"
              >
                ℹ️ ¿Cómo funciona?
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Score Total */}
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="12"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="white"
                      strokeWidth="12"
                      strokeDasharray={`${clamp(multimodal.total, 0, 100) * 4.4} 440`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-5xl font-bold">{multimodal.total}</div>
                    <div className="text-sm opacity-90">/100</div>
                  </div>
                </div>
                <p className="font-bold text-lg">Puntuación Total</p>
                <div className="mt-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm">
                  {getStatusText(multimodal.status)}
                </div>
              </div>

              {/* Desglose */}
              <div className="md:col-span-2 space-y-4">
                {/* Tests Score */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📝</span>
                      <span className="font-semibold">Tests Psicométricos</span>
                    </div>
                    <span className="text-2xl font-bold">{multimodal.testsScore}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${clamp(multimodal.testsScore, 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs mt-2 opacity-90">
                    PHQ-9: {phq9Avg}/27 · GAD-7: {gad7Avg}/21
                  </p>
                </div>

                {/* Voice Score */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎤</span>
                      <span className="font-semibold">Análisis de Voz</span>
                    </div>
                    <span className="text-2xl font-bold">{multimodal.voiceScore}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${clamp(multimodal.voiceScore, 0, 100)}%` }}
                    />
                  </div>
                  {voiceSessions.length > 0 && voiceAverages ? (
                    <p className="text-xs mt-2 opacity-90">
                      {voiceSessions.length} sesiones · Pitch: {voiceAverages.pitch} Hz · HNR: {voiceAverages.hnr} dB
                    </p>
                  ) : (
                    <p className="text-xs mt-2 opacity-90">
                      Sin datos de voz · Score neutral aplicado
                    </p>
                  )}
                </div>

                {/* Ponderación */}
                <div className="flex items-center justify-center gap-6 text-sm opacity-90">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    <span>Tests: 60%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    <span>Voz: 40%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tests y Voz lado a lado */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Tarjeta Tests */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl shadow-2xl p-8"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              📝 Tests Psicométricos
            </h3>

            <div className="space-y-4">
              {/* PHQ-9 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border-2 border-blue-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      PHQ-9 (Depresión)
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {phq9Avg}{" "}
                      <span className="text-lg text-gray-500">/ 27</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className={getTrendIcon(safePhq.trend).color}>
                        {getTrendIcon(safePhq.trend).icon}
                      </span>
                      <span
                        className={`font-medium ${getTrendIcon(safePhq.trend).color}`}
                      >
                        {getTrendIcon(safePhq.trend).text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {phqScores.length} evaluaciones
                    </p>
                  </div>
                </div>

                {/* Mini gráfica */}
                <div className="h-12 flex items-end gap-1">
                  {phqScores.slice(-10).map((score, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition cursor-pointer"
                      style={{
                        height: `${(safeNum(score) / MAX_PHQ9) * 100}%`,
                        minHeight: "4px",
                      }}
                      title={`${score}/27`}
                    />
                  ))}
                </div>
              </div>

              {/* GAD-7 */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-5 border-2 border-teal-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      GAD-7 (Ansiedad)
                    </p>
                    <p className="text-3xl font-bold text-teal-600">
                      {gad7Avg}{" "}
                      <span className="text-lg text-gray-500">/ 21</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className={getTrendIcon(safeGad.trend).color}>
                        {getTrendIcon(safeGad.trend).icon}
                      </span>
                      <span
                        className={`font-medium ${getTrendIcon(safeGad.trend).color}`}
                      >
                        {getTrendIcon(safeGad.trend).text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {gadScores.length} evaluaciones
                    </p>
                  </div>
                </div>

                {/* Mini gráfica */}
                <div className="h-12 flex items-end gap-1">
                  {gadScores.slice(-10).map((score, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-teal-500 rounded-t hover:bg-teal-600 transition cursor-pointer"
                      style={{
                        height: `${(safeNum(score) / MAX_GAD7) * 100}%`,
                        minHeight: "4px",
                      }}
                      title={`${score}/21`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tarjeta Voz */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl shadow-2xl p-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                🎤 Análisis de Voz
              </h3>
              <button
                onClick={() => showInfoModal("voice")}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                ℹ️ Info
              </button>
            </div>

            {voiceSessions.length > 0 && voiceAverages ? (
              <div className="space-y-4">
                {/* Estadísticas de voz */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Pitch Promedio</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {voiceAverages.pitch} Hz
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Energía Vocal</p>
                    <p className="text-2xl font-bold text-green-600">
                      {voiceAverages.energy}%
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                    <p className="text-xs text-gray-600 mb-1">Calidad (HNR)</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {voiceAverages.hnr} dB
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Total Sesiones</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {voiceSessions.length}
                    </p>
                  </div>
                </div>

                {/* Distribución de indicadores */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Distribución de Indicadores Vocales
                  </p>

                  <div className="space-y-2">
                    {voiceIndicatorDistribution.map(({ level, count, percent }) => {
                      const colors = {
                        LOW: { bg: "bg-green-500", text: "Favorable" },
                        MODERATE: { bg: "bg-yellow-500", text: "Atención" },
                        HIGH: { bg: "bg-orange-500", text: "Apoyo necesario" },
                      };

                      return (
                        <div key={level}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">
                              {colors[level].text}
                            </span>
                            <span className="font-semibold text-gray-700">
                              {count} ({percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`${colors[level].bg} h-2 rounded-full transition-all duration-500`}
                              style={{ width: `${clamp(percent, 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ejercicios más usados */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    📊 Ejercicios realizados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {exerciseCounts.map(([exerciseId, count]) => (
                      <span
                        key={exerciseId}
                        className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-indigo-200"
                      >
                        {exerciseNames[exerciseId] || `Ej. ${exerciseId}`}:{" "}
                        {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-50">🎤</div>
                <p className="text-gray-600 mb-4">
                  Aún no has completado ejercicios de voz
                </p>
                <button
                  onClick={() => navigate("/exercises/anxiety")}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  Comenzar ejercicios
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Gráficas de Tendencia (separadas) */}
        {(phqScores.length > 0 || gadScores.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl shadow-2xl p-8 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  Evolución Temporal
                </h3>
                <p className="text-sm text-gray-600">
                  Tendencias separadas de PHQ-9 y GAD-7
                </p>
              </div>
              <button
                onClick={() => showInfoModal("recommendations")}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition font-medium text-sm"
              >
                ℹ️ Interpretar resultados
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* PHQ-9 */}
              {phqScores.length > 0 && (
                <div className="relative h-96 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-gray-800">PHQ-9 (Depresión)</p>
                    <p className="text-sm text-gray-600">
                      Actual: <span className="font-semibold">{phqScores[phqScores.length - 1]}</span>
                    </p>
                  </div>

                  {/* Eje Y */}
                  <div className="absolute left-4 top-16 bottom-20 flex flex-col justify-between text-sm text-gray-600 font-medium">
                    <span>27</span>
                    <span>20</span>
                    <span>15</span>
                    <span>10</span>
                    <span>5</span>
                    <span>0</span>
                  </div>

                  {/* Grid */}
                  <div className="absolute left-16 right-8 top-16 bottom-20">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="absolute w-full border-t border-gray-300 border-dashed"
                        style={{ top: `${i * 20}%` }}
                      />
                    ))}
                  </div>

                  {/* SVG Chart */}
                  <div
                    className="absolute left-16 right-8 top-16 bottom-20"
                    onMouseLeave={clearHover}
                  >
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="phq9Gradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>

                      {/* Área */}
                      {phqPolygon && <polygon points={phqPolygon} fill="url(#phq9Gradient)" />}

                      {/* Línea */}
                      {phqPoints.length > 1 && (
                        <polyline
                          points={phqPolyline}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="0.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}

                      {/* Puntos */}
                      {phqPoints.map((p) => {
                        const isHovered =
                          hoveredPoint?.type === "phq9" && hoveredPoint?.index === p.index;

                        return (
                          <circle
                            key={`phq9-${p.index}`}
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? "2" : "1.2"}
                            fill="#3b82f6"
                            stroke="white"
                            strokeWidth="0.4"
                            vectorEffect="non-scaling-stroke"
                            className="cursor-pointer transition-all"
                            onMouseEnter={() =>
                              handleHoverPoint({
                                type: "phq9",
                                index: p.index,
                                score: p.score,
                                date: safePhq?.dates?.[p.index],
                              })
                            }
                          />
                        );
                      })}

                      {/* Tooltip */}
                      {hoveredPoint?.type === "phq9" && (
                        <foreignObject
                          x={clamp(
                            (hoveredPoint.index / Math.max(phqPoints.length - 1, 1)) * 100 - 15,
                            0,
                            70
                          )}
                          y={clamp(
                            100 - (safeNum(hoveredPoint.score) / MAX_PHQ9) * 100 - 25,
                            0,
                            80
                          )}
                          width="30"
                          height="20"
                        >
                          <div className="bg-white px-3 py-2 rounded-lg shadow-xl border-2 border-blue-500 text-xs whitespace-nowrap">
                            <p className="font-bold text-gray-800">PHQ-9: {hoveredPoint.score}</p>
                            <p className="text-gray-600">
                              {hoveredPoint.date
                                ? new Date(hoveredPoint.date).toLocaleDateString("es-ES")
                                : "—"}
                            </p>
                          </div>
                        </foreignObject>
                      )}
                    </svg>
                  </div>

                  {/* Eje X */}
                  <div className="absolute left-16 right-8 bottom-12 flex justify-between text-xs text-gray-600">
                    {phqXAxisLabels.map((date, index) => (
                      <span key={index}>
                        {date
                          ? new Date(date).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GAD-7 */}
              {gadScores.length > 0 && (
                <div className="relative h-96 bg-gradient-to-br from-gray-50 to-teal-50 rounded-2xl p-8">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-gray-800">GAD-7 (Ansiedad)</p>
                    <p className="text-sm text-gray-600">
                      Actual: <span className="font-semibold">{gadScores[gadScores.length - 1]}</span>
                    </p>
                  </div>

                  {/* Eje Y */}
                  <div className="absolute left-4 top-16 bottom-20 flex flex-col justify-between text-sm text-gray-600 font-medium">
                    <span>21</span>
                    <span>17</span>
                    <span>13</span>
                    <span>9</span>
                    <span>5</span>
                    <span>0</span>
                  </div>

                  {/* Grid */}
                  <div className="absolute left-16 right-8 top-16 bottom-20">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="absolute w-full border-t border-gray-300 border-dashed"
                        style={{ top: `${i * 20}%` }}
                      />
                    ))}
                  </div>

                  {/* SVG Chart */}
                  <div
                    className="absolute left-16 right-8 top-16 bottom-20"
                    onMouseLeave={clearHover}
                  >
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="gad7Gradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>

                      {/* Área */}
                      {gadPolygon && <polygon points={gadPolygon} fill="url(#gad7Gradient)" />}

                      {/* Línea */}
                      {gadPoints.length > 1 && (
                        <polyline
                          points={gadPolyline}
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="0.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}

                      {/* Puntos */}
                      {gadPoints.map((p) => {
                        const isHovered =
                          hoveredPoint?.type === "gad7" && hoveredPoint?.index === p.index;

                        return (
                          <circle
                            key={`gad7-${p.index}`}
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? "2" : "1.2"}
                            fill="#14b8a6"
                            stroke="white"
                            strokeWidth="0.4"
                            vectorEffect="non-scaling-stroke"
                            className="cursor-pointer transition-all"
                            onMouseEnter={() =>
                              handleHoverPoint({
                                type: "gad7",
                                index: p.index,
                                score: p.score,
                                date: safeGad?.dates?.[p.index],
                              })
                            }
                          />
                        );
                      })}

                      {/* Tooltip */}
                      {hoveredPoint?.type === "gad7" && (
                        <foreignObject
                          x={clamp(
                            (hoveredPoint.index / Math.max(gadPoints.length - 1, 1)) * 100 - 15,
                            0,
                            70
                          )}
                          y={clamp(
                            100 - (safeNum(hoveredPoint.score) / MAX_GAD7) * 100 - 25,
                            0,
                            80
                          )}
                          width="30"
                          height="20"
                        >
                          <div className="bg-white px-3 py-2 rounded-lg shadow-xl border-2 border-teal-500 text-xs whitespace-nowrap">
                            <p className="font-bold text-gray-800">GAD-7: {hoveredPoint.score}</p>
                            <p className="text-gray-600">
                              {hoveredPoint.date
                                ? new Date(hoveredPoint.date).toLocaleDateString("es-ES")
                                : "—"}
                            </p>
                          </div>
                        </foreignObject>
                      )}
                    </svg>
                  </div>

                  {/* Eje X */}
                  <div className="absolute left-16 right-8 bottom-12 flex justify-between text-xs text-gray-600">
                    {gadXAxisLabels.map((date, index) => (
                      <span key={index}>
                        {date
                          ? new Date(date).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* INTERPRETACIÓN MULTIMODAL CLÍNICA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-6"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            🧠 Evaluación Multimodal Integrada
          </h3>

          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-gray-800 space-y-3 text-sm leading-relaxed">
            {getClinicalMessage(multimodalClinicalResult)}
          </div>
        </motion.div>

        {/* RECOMENDACIONES */}
        {multimodal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-3xl shadow-2xl p-8"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              💡 Recomendaciones Personalizadas
            </h3>

            <div
              className={`p-6 rounded-xl border-2 ${
                multimodal.status === "excellent"
                  ? "bg-green-50 border-green-300"
                  : multimodal.status === "good"
                  ? "bg-blue-50 border-blue-300"
                  : multimodal.status === "moderate"
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-orange-50 border-orange-300"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl">
                  {multimodal.status === "excellent"
                    ? "✅"
                    : multimodal.status === "good"
                    ? "👍"
                    : multimodal.status === "moderate"
                    ? "💪"
                    : "🤝"}
                </span>

                <div className="flex-1">
                  {multimodal.status === "excellent" && (
                    <>
                      <p className="font-bold text-green-900 mb-2">
                        ¡Excelente trabajo!
                      </p>
                      <p className="text-green-800 mb-3">
                        Tanto tus tests como tu análisis de voz muestran un muy
                        buen estado de bienestar. Continúa con tus hábitos
                        saludables.
                      </p>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Mantén tu rutina de ejercicios de voz</li>
                        <li>• Practica actividades que disfrutes</li>
                        <li>• Comparte tu bienestar con otros</li>
                      </ul>
                    </>
                  )}

                  {multimodal.status === "good" && (
                    <>
                      <p className="font-bold text-blue-900 mb-2">
                        Vas por buen camino
                      </p>
                      <p className="text-blue-800 mb-3">
                        Tu evaluación multimodal es positiva. Considera aumentar
                        la frecuencia de tus ejercicios de voz para potenciar
                        tus resultados.
                      </p>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Practica ejercicios de voz 3-4 veces por semana</li>
                        <li>• Mantén evaluaciones regulares de PHQ-9/GAD-7</li>
                        <li>• Incorpora técnicas de relajación</li>
                      </ul>
                    </>
                  )}

                  {multimodal.status === "moderate" && (
                    <>
                      <p className="font-bold text-yellow-900 mb-2">
                        Puedes mejorar con pequeños cambios
                      </p>
                      <p className="text-yellow-800 mb-3">
                        {multimodal.testsScore > multimodal.voiceScore
                          ? "Tu voz sugiere que podrías estar experimentando tensión no reconocida. Es una oportunidad para cuidarte más."
                          : "Tus tests muestran algunas áreas de oportunidad. Reflexionar sobre cómo te sientes puede ayudarte."}
                      </p>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Aumenta la frecuencia de ejercicios de voz</li>
                        <li>• Practica técnicas de manejo del estrés diariamente</li>
                        <li>• Considera hablar con alguien de confianza</li>
                      </ul>
                    </>
                  )}

                  {(multimodal.status === "needs_attention" ||
                    multimodal.status === "needs_support") && (
                    <>
                      <p className="font-bold text-orange-900 mb-2">
                        Mereces recibir apoyo profesional
                      </p>
                      <p className="text-orange-800 mb-3">
                        Tu evaluación multimodal sugiere que buscar ayuda profesional
                        puede ser muy beneficioso para ti.
                        {Math.abs(multimodal.testsScore - multimodal.voiceScore) >
                          20 && (
                          <>
                            {" "}
                            Hay diferencias entre tus tests y análisis de voz que vale 
                            la pena explorar con un especialista.
                          </>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-4">
                        <a
                          href="tel:952"
                          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition shadow-lg"
                        >
                          📞 Llamar Línea 952
                        </a>
                        <button
                          onClick={() => navigate("/home")}
                          className="px-6 py-3 bg-white border-2 border-orange-600 text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition"
                        >
                          Ver recursos de ayuda
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Extra visual opcional: etiqueta del estado */}
            <div className="mt-6 flex justify-center">
              <div
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-bold shadow-lg bg-gradient-to-r ${getStatusColor(
                  multimodal.status
                )}`}
              >
                <span>Estado:</span>
                <span>{getStatusText(multimodal.status)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;