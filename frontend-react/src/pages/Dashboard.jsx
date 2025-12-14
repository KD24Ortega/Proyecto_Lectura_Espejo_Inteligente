import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import FaceMonitor from '../components/FaceMonitor';
import { getEmotionalState, getTheme } from '../utils/themeSystem';

// Modal de información
const InfoModal = ({ isOpen, onClose, title, content, icon }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{icon}</span>
                <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
            {content}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [trendsData, setTrendsData] = useState(null);
  const [voiceData, setVoiceData] = useState(null);
  const [timeRange, setTimeRange] = useState(30);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [showInfo, setShowInfo] = useState(null);

  // Theme dinámico (arranca con sin evaluación para evitar nulls)
  const [theme, setTheme] = useState(getTheme('sin_evaluacion'));

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('user_id');
      const name = localStorage.getItem('user_name');

      if (!userId) {
        navigate('/');
        return;
      }

      setUserName(name || '');

      // Cargar datos de tests
      const trendsResponse = await api.get(`/trends/analyze/${userId}?days=${timeRange}`);
      setTrendsData(trendsResponse.data);

      // Cargar datos de voz
      try {
        const voiceResponse = await api.get(`/api/voice/user/${userId}/stats?days=${timeRange}`);
        console.log('Datos de voz recibidos:', voiceResponse.data);
        setVoiceData(voiceResponse.data);
      } catch (error) {
        console.log('Error cargando datos de voz:', error.response?.data || error.message);
        setVoiceData(null);
      }

    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar theme cuando hay nuevos trendsData (igual que Home)
  useEffect(() => {
    if (!trendsData) {
      setTheme(getTheme('sin_evaluacion'));
      return;
    }

    const phqLast =
      trendsData?.phq9?.scores?.length > 0
        ? trendsData.phq9.scores[trendsData.phq9.scores.length - 1]
        : null;

    const gadLast =
      trendsData?.gad7?.scores?.length > 0
        ? trendsData.gad7.scores[trendsData.gad7.scores.length - 1]
        : null;

    const state = getEmotionalState(phqLast, gadLast);
    setTheme(getTheme(state));
  }, [trendsData]);

  // Calcular puntuación multimodal
  const calculateMultimodalScore = () => {
    if (!trendsData) return null;

    const testsScore = trendsData?.overall?.tests_score ?? 0;
    let voiceScore = 50; // Score neutral por defecto

    const hasSessions = !!(voiceData?.sessions?.length);

    if (hasSessions) {
      // Calcular score de voz basado en niveles de riesgo
      const riskScores = voiceData.sessions.map(session => {
        const r = (session?.risk_level || '').toString().toUpperCase();
        if (r === 'LOW') return 90;
        if (r === 'MODERATE') return 60;
        if (r === 'HIGH') return 30;
        return 50;
      });
      voiceScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    }

    // Ponderación: 60% tests, 40% voz
    const multimodalScore = (testsScore * 0.6) + (voiceScore * 0.4);

    return {
      total: Math.round(multimodalScore),
      testsScore: Math.round(testsScore),
      voiceScore: Math.round(voiceScore),
      status: getMultimodalStatus(multimodalScore),
      hasVoiceData: hasSessions
    };
  };

  const getMultimodalStatus = (score) => {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 45) return 'moderate';
    if (score >= 30) return 'concerning';
    return 'critical';
  };

  const getStatusColor = (status) => {
    const colors = {
      'excellent': 'from-green-500 to-emerald-500',
      'good': 'from-blue-500 to-cyan-500',
      'moderate': 'from-yellow-500 to-orange-500',
      'concerning': 'from-orange-500 to-red-500',
      'critical': 'from-red-600 to-red-800'
    };
    return colors[status] || 'from-gray-500 to-gray-700';
  };

  const getStatusText = (status) => {
    const texts = {
      'excellent': 'Excelente',
      'good': 'Bueno',
      'moderate': 'Moderado',
      'concerning': 'Preocupante',
      'critical': 'Crítico'
    };
    return texts[status] || status;
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return { icon: '📈', text: 'Mejorando', color: 'text-green-600' };
    if (trend === 'worsening') return { icon: '📉', text: 'Empeorando', color: 'text-red-600' };
    return { icon: '➡️', text: 'Estable', color: 'text-gray-600' };
  };

  const showInfoModal = (type) => {
    const content = {
      multimodal: {
        title: 'Puntuación Multimodal',
        icon: '🎯',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">
              La <strong>Puntuación Multimodal</strong> combina datos de múltiples fuentes para
              ofrecer una evaluación integral de tu bienestar mental:
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
        )
      },
      voice: {
        title: 'Análisis de Voz',
        icon: '🎤',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">
              El análisis de voz evalúa biomarcadores acústicos que se correlacionan con
              estados emocionales y salud mental.
            </p>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5">
              <h4 className="font-bold text-purple-900 mb-3">Biomarcadores medidos:</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">F0</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Pitch (Tono fundamental)</p>
                    <p className="text-gray-600">Frecuencia de tu voz. Valores bajos pueden indicar depresión.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">E</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Energía vocal</p>
                    <p className="text-gray-600">Intensidad de tu voz. Baja energía se asocia con fatiga emocional.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">HNR</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Calidad vocal (HNR)</p>
                    <p className="text-gray-600">Relación armónicos/ruido. Mide estabilidad emocional.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>💡 Importante:</strong> Los análisis de voz son complementarios a las
                evaluaciones clínicas tradicionales, no las reemplazan.
              </p>
            </div>
          </div>
        )
      },
      recommendations: {
        title: 'Interpretación de Resultados',
        icon: 'ℹ️',
        content: (
          <div className="space-y-4 text-gray-700">
            <p>
              Aquí estás viendo la evolución de <strong>PHQ-9</strong> (depresión) y <strong>GAD-7</strong> (ansiedad).
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
              ⚠️ Esto no es diagnóstico clínico. Es una guía orientativa basada en escalas psicométricas.
            </p>
          </div>
        )
      }
    };

    if (!content[type]) return;
    setShowInfo(content[type]);
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme.colors.primary} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-white/90">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  if (!trendsData || (trendsData.phq9.scores.length === 0 && trendsData.gad7.scores.length === 0)) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme.colors.primary} flex items-center justify-center p-6`}>
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
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
          >
            Ir al Home
          </button>
        </motion.div>
      </div>
    );
  }

  const { phq9, gad7 } = trendsData;
  const phq9Avg = phq9.scores.length > 0 ? (phq9.scores.reduce((a, b) => a + b, 0) / phq9.scores.length).toFixed(1) : 0;
  const gad7Avg = gad7.scores.length > 0 ? (gad7.scores.reduce((a, b) => a + b, 0) / gad7.scores.length).toFixed(1) : 0;

  const multimodal = calculateMultimodalScore();

  // Calcular promedios de voz con validación
  const voiceAverages = voiceData && voiceData.sessions && voiceData.sessions.length > 0 ? {
    pitch: (voiceData.sessions.reduce((sum, s) => sum + (parseFloat(s.pitch_mean) || 0), 0) / voiceData.sessions.length).toFixed(1),
    energy: (voiceData.sessions.reduce((sum, s) => sum + (parseFloat(s.energy) || 0), 0) / voiceData.sessions.length * 100).toFixed(1),
    hnr: (voiceData.sessions.reduce((sum, s) => sum + (parseFloat(s.hnr) || 0), 0) / voiceData.sessions.length).toFixed(1)
  } : null;

  // ===============================
  // ANÁLISIS MULTIMODAL CLÍNICO REAL (CORREGIDO)
  // ===============================

  // Normalizar riesgo vocal y tomar el MÁS ALTO (criterio conservador)
  const getMaxVoiceRisk = () => {
    if (!voiceData?.sessions?.length) return 'LOW';
    const order = { LOW: 0, MODERATE: 1, HIGH: 2 };

    return voiceData.sessions.reduce((max, s) => {
      const r = (s?.risk_level || '').toString().toUpperCase();
      const rr = order[r] !== undefined ? r : 'LOW';
      return order[rr] > order[max] ? rr : max;
    }, 'LOW');
  };

  const voiceRisk = getMaxVoiceRisk();

  // Umbrales clínicos estándar
  const phqPositive = Number(phq9Avg) >= 10;
  const gadPositive = Number(gad7Avg) >= 10;

  // ✅ Fusión multimodal sin “INDETERMINADO”: cubre TODAS las combinaciones
  const interpretMultimodal = () => {
    // Ambos positivos
    if (phqPositive && gadPositive) {
      if (voiceRisk === 'HIGH') return 'DEPRESION_Y_ANSIEDAD_ALTA_PROB';
      if (voiceRisk === 'MODERATE') return 'DEPRESION_Y_ANSIEDAD_PROBABLE';
      return 'DEPRESION_Y_ANSIEDAD_EN_TESTS';
    }

    // Solo PHQ positivo
    if (phqPositive && !gadPositive) {
      if (voiceRisk === 'HIGH') return 'DEPRESION_ALTA_PROB';
      if (voiceRisk === 'MODERATE') return 'DEPRESION_PROBABLE';
      return 'DEPRESION_EN_TESTS';
    }

    // Solo GAD positivo
    if (!phqPositive && gadPositive) {
      if (voiceRisk === 'HIGH') return 'ANSIEDAD_ALTA_PROB';
      if (voiceRisk === 'MODERATE') return 'ANSIEDAD_PROBABLE';
      return 'ANSIEDAD_EN_TESTS';
    }

    // Ninguno positivo
    if (!phqPositive && !gadPositive) {
      if (voiceRisk === 'HIGH') return 'RIESGO_VOCAL_ALTO_SIN_TESTS';
      if (voiceRisk === 'MODERATE') return 'RIESGO_EMOCIONAL_LEVE';
      return 'SIN_INDICIOS';
    }

    return 'SIN_INDICIOS';
  };

  const multimodalClinicalResult = interpretMultimodal();

  const getClinicalMessage = (result) => {
    const baseDisclaimer = (
      <p className="text-xs text-gray-600 mt-3">
        ⚠️ Este resultado no constituye un diagnóstico clínico y no reemplaza una evaluación profesional.
      </p>
    );

    switch (result) {
      case 'DEPRESION_Y_ANSIEDAD_ALTA_PROB':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Se detectaron biomarcadores vocales asociados a alteraciones emocionales significativas (riesgo ALTO).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> PHQ-9 y GAD-7 sugieren síntomas compatibles con depresión y ansiedad moderadas.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Se recomienda seguimiento y orientación profesional.</p>
            {baseDisclaimer}
          </>
        );

      case 'DEPRESION_Y_ANSIEDAD_PROBABLE':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Biomarcadores moderados (riesgo MODERADO).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> PHQ-9 y GAD-7 ≥ 10.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Seguimiento cercano y apoyo profesional si es posible.</p>
            {baseDisclaimer}
          </>
        );

      case 'DEPRESION_Y_ANSIEDAD_EN_TESTS':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> No se detectan señales fuertes (LOW).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> Los tests (PHQ-9 y GAD-7) reportan síntomas relevantes.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Considera evaluación profesional para validar resultados.</p>
            {baseDisclaimer}
          </>
        );

      case 'DEPRESION_ALTA_PROB':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Se detectaron biomarcadores vocales fuertes (riesgo ALTO).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> PHQ-9 ≥ 10, GAD-7 &lt; 10.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Se sugiere evaluación clínica.</p>
            {baseDisclaimer}
          </>
        );

      case 'DEPRESION_PROBABLE':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Biomarcadores moderados (riesgo MODERADO).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> PHQ-9 ≥ 10.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Seguimiento y hábitos de apoyo; buscar ayuda si empeora.</p>
            {baseDisclaimer}
          </>
        );

      case 'DEPRESION_EN_TESTS':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> LOW.</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> PHQ-9 ≥ 10 (alerta por auto-reporte).</p>
            <p className="mt-2"><strong>Recomendación:</strong> Valida con un profesional si los síntomas impactan tu día a día.</p>
            {baseDisclaimer}
          </>
        );

      case 'ANSIEDAD_ALTA_PROB':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Se detectaron biomarcadores vocales fuertes (riesgo ALTO).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> GAD-7 ≥ 10, PHQ-9 &lt; 10.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Se recomienda orientación profesional.</p>
            {baseDisclaimer}
          </>
        );

      case 'ANSIEDAD_PROBABLE':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Biomarcadores moderados (riesgo MODERADO).</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> GAD-7 ≥ 10.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Técnicas de regulación y seguimiento.</p>
            {baseDisclaimer}
          </>
        );

      case 'ANSIEDAD_EN_TESTS':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> LOW.</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> GAD-7 ≥ 10 (alerta por auto-reporte).</p>
            <p className="mt-2"><strong>Recomendación:</strong> Valida con apoyo profesional si se mantiene.</p>
            {baseDisclaimer}
          </>
        );

      case 'RIESGO_VOCAL_ALTO_SIN_TESTS':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Riesgo ALTO en biomarcadores vocales.</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> Tests bajos (PHQ-9 y GAD-7 &lt; 10).</p>
            <p className="mt-2"><strong>Recomendación:</strong> Repite ejercicios y revisa factores (sueño, estrés, fatiga). Si persiste, busca orientación.</p>
            {baseDisclaimer}
          </>
        );

      case 'RIESGO_EMOCIONAL_LEVE':
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> Se detectaron biomarcadores leves/moderados.</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> Tests sin indicios clínicos (PHQ-9 y GAD-7 &lt; 10).</p>
            <p className="mt-2"><strong>Recomendación:</strong> Mantener seguimiento preventivo.</p>
            {baseDisclaimer}
          </>
        );

      case 'SIN_INDICIOS':
      default:
        return (
          <>
            <p><strong>Resultado del análisis vocal:</strong> No se detectaron patrones vocales relevantes.</p>
            <p className="mt-2"><strong>Evaluación combinada:</strong> Los cuestionarios no sugieren alteraciones clínicamente significativas.</p>
            <p className="mt-2"><strong>Recomendación:</strong> Continúa con hábitos saludables.</p>
            {baseDisclaimer}
          </>
        );
    }
  };

  const temporalData = [];

  if (phq9.scores.length > 0) {
    phq9.scores.forEach((score, index) => {
      temporalData.push({
        index,
        phq9: score,
        gad7: gad7.scores[index] ?? null
      });
    });
  }

  const MAX_PHQ9 = 27;
  const MAX_GAD7 = 21;
  const GRAPH_HEIGHT = 180;
  console.log('temporalData', temporalData);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.colors.primary} p-6 transition-all duration-1000`}>

      <FaceMonitor isActive={true} />

      <InfoModal
        isOpen={showInfo !== null}
        onClose={() => setShowInfo(null)}
        title={showInfo?.title}
        icon={showInfo?.icon}
        content={showInfo?.content}
      />

      <div className="max-w-7xl mx-auto">

        {/* Header mejorado */}
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
              Hola, <span className="font-semibold">{userName}</span> · Análisis de tus últimos {timeRange} días
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex gap-2 bg-white rounded-lg p-1 shadow-md">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    timeRange === days
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {days} días
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/home')}
              className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition shadow-md font-medium flex items-center gap-2"
            >
              <span>←</span>
              <span>Volver</span>
            </button>
          </div>
        </motion.div>

        {/* SCORE MULTIMODAL - HERO SECTION */}
        {multimodal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-2xl p-8 mb-6 text-white"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">🎯 Evaluación Multimodal</h2>
                <p className="text-white/90">Combina análisis de tests y voz</p>
              </div>
              <button
                onClick={() => showInfoModal('multimodal')}
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
                      strokeDasharray={`${multimodal.total * 4.4} 440`}
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
                      style={{ width: `${multimodal.testsScore}%` }}
                    />
                  </div>
                  <p className="text-xs mt-2 opacity-90">PHQ-9: {phq9Avg}/27 · GAD-7: {gad7Avg}/21</p>
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
                      style={{ width: `${multimodal.voiceScore}%` }}
                    />
                  </div>
                  {voiceData && voiceData.sessions.length > 0 ? (
                    <p className="text-xs mt-2 opacity-90">
                      {voiceData.sessions.length} sesiones · Pitch: {voiceAverages.pitch} Hz · HNR: {voiceAverages.hnr} dB
                    </p>
                  ) : (
                    <p className="text-xs mt-2 opacity-90">Sin datos de voz · Score neutral aplicado</p>
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
                    <p className="text-sm text-gray-600 mb-1">PHQ-9 (Depresión)</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {phq9Avg} <span className="text-lg text-gray-500">/ 27</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className={getTrendIcon(phq9.trend).color}>
                        {getTrendIcon(phq9.trend).icon}
                      </span>
                      <span className={`font-medium ${getTrendIcon(phq9.trend).color}`}>
                        {getTrendIcon(phq9.trend).text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{phq9.scores.length} evaluaciones</p>
                  </div>
                </div>

                {/* Mini gráfica */}
                <div className="h-12 flex items-end gap-1">
                  {phq9.scores.slice(-10).map((score, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition cursor-pointer"
                      style={{ height: `${(score / MAX_PHQ9) * 100}%`, minHeight: '4px' }}
                      title={`${score}/27`}
                    />
                  ))}
                </div>
              </div>

              {/* GAD-7 */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-5 border-2 border-teal-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">GAD-7 (Ansiedad)</p>
                    <p className="text-3xl font-bold text-teal-600">
                      {gad7Avg} <span className="text-lg text-gray-500">/ 21</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className={getTrendIcon(gad7.trend).color}>
                        {getTrendIcon(gad7.trend).icon}
                      </span>
                      <span className={`font-medium ${getTrendIcon(gad7.trend).color}`}>
                        {getTrendIcon(gad7.trend).text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{gad7.scores.length} evaluaciones</p>
                  </div>
                </div>

                {/* Mini gráfica */}
                <div className="h-12 flex items-end gap-1">
                  {gad7.scores.slice(-10).map((score, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-teal-500 rounded-t hover:bg-teal-600 transition cursor-pointer"
                      style={{ height: `${(score / MAX_GAD7) * 100}%`, minHeight: '4px' }}
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
                onClick={() => showInfoModal('voice')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                ℹ️ Info
              </button>
            </div>

            {voiceData && voiceData.sessions.length > 0 ? (
              <div className="space-y-4">

                {/* Estadísticas de voz */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Pitch Promedio</p>
                    <p className="text-2xl font-bold text-purple-600">{voiceAverages.pitch} Hz</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Energía Vocal</p>
                    <p className="text-2xl font-bold text-green-600">{voiceAverages.energy}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                    <p className="text-xs text-gray-600 mb-1">Calidad (HNR)</p>
                    <p className="text-2xl font-bold text-orange-600">{voiceAverages.hnr} dB</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Total Sesiones</p>
                    <p className="text-2xl font-bold text-blue-600">{voiceData.sessions.length}</p>
                  </div>
                </div>

                {/* Distribución de riesgo */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Distribución de Nivel de Riesgo</p>
                  {console.log('Risk levels en sesiones:', voiceData.sessions.map(s => s.risk_level))}
                  <div className="space-y-2">
                    {['LOW', 'MODERATE', 'HIGH'].map(level => {
                      const count = voiceData.sessions.filter(s => {
                        const riskLevel = typeof s.risk_level === 'string'
                          ? s.risk_level.toUpperCase()
                          : s.risk_level;
                        return riskLevel === level;
                      }).length;
                      const percent = voiceData.sessions.length > 0
                        ? ((count / voiceData.sessions.length) * 100).toFixed(0)
                        : 0;
                      const colors = {
                        LOW: { bg: 'bg-green-500', text: 'Bajo' },
                        MODERATE: { bg: 'bg-yellow-500', text: 'Moderado' },
                        HIGH: { bg: 'bg-red-500', text: 'Alto' }
                      };
                      return (
                        <div key={level}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{colors[level].text}</span>
                            <span className="font-semibold text-gray-700">{count} ({percent}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`${colors[level].bg} h-2 rounded-full transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ejercicios más usados */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">📊 Ejercicios realizados</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(voiceData.sessions.map(s => s.exercise_id))).map(exerciseId => {
                      const count = voiceData.sessions.filter(s => s.exercise_id === exerciseId).length;
                      const exerciseNames = {
                        1: 'Respiración',
                        2: 'Lectura',
                        3: 'Vocal',
                        4: 'Prosódica',
                        5: 'Afirmaciones',
                        6: 'Diálogo'
                      };
                      return (
                        <span key={exerciseId} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-indigo-200">
                          {exerciseNames[exerciseId] || `Ej. ${exerciseId}`}: {count}
                        </span>
                      );
                    })}
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
                  onClick={() => navigate('/exercises/anxiety')}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  Comenzar ejercicios
                </button>
              </div>
            )}
          </motion.div>

        </div>

        {/* Gráfica Lineal Comparativa MEJORADA */}
        {(phq9.scores.length > 0 || gad7.scores.length > 0) && (
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
                  Seguimiento de tus evaluaciones en el tiempo
                </p>
              </div>
              <button
                onClick={() => showInfoModal('recommendations')}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition font-medium text-sm"
              >
                ℹ️ Interpretar resultados
              </button>
            </div>

            <div className="relative h-96 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8">

              {/* Eje Y */}
              <div className="absolute left-4 top-8 bottom-20 flex flex-col justify-between text-sm text-gray-600 font-medium">
                <span>27</span>
                <span>20</span>
                <span>15</span>
                <span>10</span>
                <span>5</span>
                <span>0</span>
              </div>

              {/* Grid */}
              <div className="absolute left-16 right-8 top-8 bottom-20">
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
                className="absolute left-16 right-8 top-8 bottom-20"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="phq9Gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="gad7Gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  {/* Área PHQ-9 */}
                  {phq9.scores.length > 0 && (
                    <polygon
                      points={`
                        0,100 
                        ${phq9.scores.map((score, index) => {
                          const x = (index / Math.max(phq9.scores.length - 1, 1)) * 100;
                          const y = 100 - (score / MAX_PHQ9) * 100;
                          return `${x},${y}`;
                        }).join(' ')}
                        100,100
                      `}
                      fill="url(#phq9Gradient)"
                    />
                  )}

                  {/* Área GAD-7 (CORREGIDO: usa MAX_GAD7 = 21) */}
                  {gad7.scores.length > 0 && (
                    <polygon
                      points={`
                        0,100 
                        ${gad7.scores.map((score, index) => {
                          const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                          const y = 100 - (score / MAX_GAD7) * 100;
                          return `${x},${y}`;
                        }).join(' ')}
                        100,100
                      `}
                      fill="url(#gad7Gradient)"
                    />
                  )}

                  {/* Línea PHQ-9 */}
                  {phq9.scores.length > 1 && (
                    <polyline
                      points={phq9.scores.map((score, index) => {
                        const x = (index / Math.max(phq9.scores.length - 1, 1)) * 100;
                        const y = 100 - (score / MAX_PHQ9) * 100;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="0.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Puntos PHQ-9 con hover */}
                  {phq9.scores.map((score, index) => {
                    const x = (index / Math.max(phq9.scores.length - 1, 1)) * 100;
                    const y = 100 - (score / MAX_PHQ9) * 100;
                    const isHovered = hoveredPoint?.type === 'phq9' && hoveredPoint?.index === index;
                    return (
                      <circle
                        key={`phq9-${index}`}
                        cx={x}
                        cy={y}
                        r={isHovered ? "2" : "1.2"}
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPoint({ type: 'phq9', index, score, date: phq9.dates[index] })}
                      />
                    );
                  })}

                  {/* Línea GAD-7 (CORREGIDO) */}
                  {gad7.scores.length > 1 && (
                    <polyline
                      points={gad7.scores.map((score, index) => {
                        const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                        const y = 100 - (score / MAX_GAD7) * 100;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="0.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Puntos GAD-7 con hover */}
                  {gad7.scores.map((score, index) => {
                    const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                    const y = 100 - (score / MAX_GAD7) * 100;
                    const isHovered = hoveredPoint?.type === 'gad7' && hoveredPoint?.index === index;
                    return (
                      <circle
                        key={`gad7-${index}`}
                        cx={x}
                        cy={y}
                        r={isHovered ? "2" : "1.2"}
                        fill="#14b8a6"
                        stroke="white"
                        strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPoint({ type: 'gad7', index, score, date: gad7.dates[index] })}
                      />
                    );
                  })}

                  {/* Tooltip en hover */}
                  {hoveredPoint && (
                    <foreignObject
                      x={
                        hoveredPoint.type === 'phq9'
                          ? (hoveredPoint.index / Math.max(phq9.scores.length - 1, 1)) * 100 - 15
                          : (hoveredPoint.index / Math.max(gad7.scores.length - 1, 1)) * 100 - 15
                      }
                      y={
                        hoveredPoint.type === 'phq9'
                          ? (100 - (hoveredPoint.score / MAX_PHQ9) * 100 - 25)
                          : (100 - (hoveredPoint.score / MAX_GAD7) * 100 - 25)
                      }
                      width="30"
                      height="20"
                    >
                      <div className="bg-white px-3 py-2 rounded-lg shadow-xl border-2 border-blue-500 text-xs whitespace-nowrap">
                        <p className="font-bold text-gray-800">
                          {hoveredPoint.type === 'phq9' ? 'PHQ-9' : 'GAD-7'}: {hoveredPoint.score}
                        </p>
                        <p className="text-gray-600">
                          {new Date(hoveredPoint.date).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </foreignObject>
                  )}
                </svg>
              </div>

              {/* Eje X */}
              <div className="absolute left-16 right-8 bottom-12 flex justify-between text-xs text-gray-600">
                {(phq9.dates.length > 0 ? phq9.dates : gad7.dates).slice(0, 6).map((date, index) => (
                  <span key={index}>
                    {new Date(date).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short'
                    })}
                  </span>
                ))}
              </div>

              {/* Leyenda mejorada */}
              <div className="absolute top-8 right-8 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border-2 border-gray-200">
                <p className="text-xs text-gray-600 mb-3 font-semibold">LEYENDA</p>
                <div className="flex flex-col gap-2 text-sm">
                  {phq9.scores.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="font-medium text-gray-700">PHQ-9</p>
                        <p className="text-xs text-gray-500">Actual: {phq9.scores[phq9.scores.length - 1]}</p>
                      </div>
                    </div>
                  )}
                  {gad7.scores.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-teal-500"></div>
                      <div>
                        <p className="font-medium text-gray-700">GAD-7</p>
                        <p className="text-xs text-gray-500">Actual: {gad7.scores[gad7.scores.length - 1]}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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

        {/* Recomendaciones basadas en análisis multimodal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-3xl shadow-2xl p-8"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            💡 Recomendaciones Personalizadas
          </h3>

          <div className={`p-6 rounded-xl border-2 ${
            multimodal.status === 'excellent' ? 'bg-green-50 border-green-300' :
              multimodal.status === 'good' ? 'bg-blue-50 border-blue-300' :
                multimodal.status === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-4">
              <span className="text-4xl">
                {multimodal.status === 'excellent' ? '✅' :
                  multimodal.status === 'good' ? '👍' :
                    multimodal.status === 'moderate' ? '⚠️' : '🚨'}
              </span>
              <div className="flex-1">
                {multimodal.status === 'excellent' && (
                  <>
                    <p className="font-bold text-green-900 mb-2">¡Excelente trabajo!</p>
                    <p className="text-green-800 mb-3">
                      Tanto tus tests como tu análisis de voz muestran un muy buen estado de bienestar.
                      Continúa con tus hábitos saludables.
                    </p>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Mantén tu rutina de ejercicios de voz</li>
                      <li>• Practica actividades que disfrutes</li>
                      <li>• Comparte tu bienestar con otros</li>
                    </ul>
                  </>
                )}
                {multimodal.status === 'good' && (
                  <>
                    <p className="font-bold text-blue-900 mb-2">Vas por buen camino</p>
                    <p className="text-blue-800 mb-3">
                      Tu evaluación multimodal es positiva. Considera aumentar la frecuencia de
                      tus ejercicios de voz para potenciar tus resultados.
                    </p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Practica ejercicios de voz 3-4 veces por semana</li>
                      <li>• Mantén evaluaciones regulares de PHQ-9/GAD-7</li>
                      <li>• Incorpora técnicas de relajación</li>
                    </ul>
                  </>
                )}
                {multimodal.status === 'moderate' && (
                  <>
                    <p className="font-bold text-yellow-900 mb-2">Es momento de actuar</p>
                    <p className="text-yellow-800 mb-3">
                      {multimodal.testsScore > multimodal.voiceScore ?
                        'Tu voz muestra más señales de estrés que tus tests. Esto puede indicar tensión no reconocida.' :
                        'Tus tests muestran más preocupación que tu voz. Considera evaluar cómo te sientes realmente.'
                      }
                    </p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Aumenta la frecuencia de ejercicios de voz</li>
                      <li>• Practica técnicas de manejo del estrés diariamente</li>
                      <li>• Considera hablar con alguien de confianza</li>
                    </ul>
                  </>
                )}
                {(multimodal.status === 'concerning' || multimodal.status === 'critical') && (
                  <>
                    <p className="font-bold text-red-900 mb-2">Necesitas apoyo profesional</p>
                    <p className="text-red-800 mb-3">
                      Tu evaluación multimodal indica que sería muy beneficioso buscar ayuda profesional.
                      {Math.abs(multimodal.testsScore - multimodal.voiceScore) > 20 &&
                        ' Hay una discrepancia significativa entre tus tests y análisis de voz, lo cual refuerza esta recomendación.'
                      }
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <a
                        href="tel:952"
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shadow-lg"
                      >
                        📞 Llamar Línea 952
                      </a>
                      <button
                        onClick={() => navigate('/home')}
                        className="px-6 py-3 bg-white border-2 border-red-600 text-red-600 rounded-lg font-bold hover:bg-red-50 transition"
                      >
                        Ver recursos de ayuda
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default Dashboard;
