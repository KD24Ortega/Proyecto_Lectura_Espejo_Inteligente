import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import FaceMonitor from '../components/FaceMonitor';

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
  const [timeRange, setTimeRange] = useState(30); // 7, 30, 90 días
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [showInfo, setShowInfo] = useState(null);

  useEffect(() => {
    loadDashboard();
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
      
      setUserName(name);
      
      const response = await api.get(`/trends/analyze/${userId}?days=${timeRange}`);
      setTrendsData(response.data);
      
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setIsLoading(false);
    }
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
      phq9: {
        title: 'Sobre PHQ-9',
        icon: '📋',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">
              El <strong>PHQ-9</strong> (Patient Health Questionnaire-9) es un cuestionario validado 
              científicamente para evaluar la presencia y severidad de síntomas depresivos.
            </p>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
              <h4 className="font-bold text-blue-900 mb-3">Rangos de puntuación:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span><strong>0-4:</strong> Mínima o sin depresión</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span><strong>5-9:</strong> Depresión leve</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span><strong>10-14:</strong> Depresión moderada</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  <span><strong>15-19:</strong> Depresión moderadamente severa</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span><strong>20-27:</strong> Depresión severa</span>
                </li>
              </ul>
            </div>
          </div>
        )
      },
      gad7: {
        title: 'Sobre GAD-7',
        icon: '📊',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">
              El <strong>GAD-7</strong> (Generalized Anxiety Disorder-7) es una herramienta validada 
              para medir la severidad de síntomas de ansiedad generalizada.
            </p>
            <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-5">
              <h4 className="font-bold text-teal-900 mb-3">Rangos de puntuación:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span><strong>0-4:</strong> Ansiedad mínima</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span><strong>5-9:</strong> Ansiedad leve</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span><strong>10-14:</strong> Ansiedad moderada</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span><strong>15-21:</strong> Ansiedad severa</span>
                </li>
              </ul>
            </div>
          </div>
        )
      },
      recommendations: {
        title: 'Interpretación de Resultados',
        icon: '💡',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">
              Tu puntuación general se calcula considerando tus evaluaciones de PHQ-9 y GAD-7 
              en el período seleccionado.
            </p>
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-green-900 mb-2">✅ Excelente (80-100)</h4>
                <p className="text-sm text-gray-700">
                  Mantén tus hábitos saludables y continúa con tus rutinas de bienestar.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-900 mb-2">👍 Bueno (60-79)</h4>
                <p className="text-sm text-gray-700">
                  Estás en buen camino. Considera incorporar más actividades de autocuidado.
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold text-yellow-900 mb-2">⚠️ Moderado (40-59)</h4>
                <p className="text-sm text-gray-700">
                  Es momento de enfocarte en tu bienestar. Practica técnicas de manejo del estrés.
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">🚨 Crítico (&lt;40)</h4>
                <p className="text-sm text-gray-700">
                  Te recomendamos buscar apoyo profesional de inmediato. Línea 952.
                </p>
              </div>
            </div>
          </div>
        )
      }
    };

    setShowInfo(content[type]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-600">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  if (!trendsData || (trendsData.phq9.scores.length === 0 && trendsData.gad7.scores.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center p-6">
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

  const { phq9, gad7, overall } = trendsData;
  const phq9Avg = phq9.scores.length > 0 ? (phq9.scores.reduce((a, b) => a + b, 0) / phq9.scores.length).toFixed(1) : 0;
  const gad7Avg = gad7.scores.length > 0 ? (gad7.scores.reduce((a, b) => a + b, 0) / gad7.scores.length).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6">

      <FaceMonitor isActive={true} />

      {/* Modal de información */}
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
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              📊 Mi Dashboard
            </h1>
            <p className="text-gray-600 text-lg">
              Hola, <span className="font-semibold text-blue-600">{userName}</span> · Análisis de tus últimos {timeRange} días
            </p>
          </div>

          <div className="flex gap-3">
            {/* Selector de rango */}
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

        {/* Score General mejorado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-6"
        >
          <div className="grid md:grid-cols-3 gap-8 items-center">
            
            {/* Gráfico circular */}
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Puntuación General
              </h2>
              <div className="relative inline-block">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="16"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="16"
                    strokeDasharray={`${overall.tests_score * 5.03} 502.65`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-5xl font-bold text-gray-800">
                    {Math.round(overall.tests_score)}
                  </div>
                  <div className="text-sm text-gray-600">/ 100</div>
                </div>
              </div>
              <div className={`mt-4 inline-block px-6 py-3 bg-gradient-to-r ${getStatusColor(overall.status)} text-white rounded-full font-bold text-lg shadow-lg`}>
                {getStatusText(overall.status)}
              </div>
            </div>

            {/* Resumen de métricas */}
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                
                {/* PHQ-9 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border-2 border-blue-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">PHQ-9 (Depresión)</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {phq9Avg} <span className="text-lg text-gray-500">/ 27</span>
                      </p>
                    </div>
                    <button
                      onClick={() => showInfoModal('phq9')}
                      className="text-2xl hover:scale-110 transition"
                      title="Más información"
                    >
                      ℹ️
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={getTrendIcon(phq9.trend).color}>
                      {getTrendIcon(phq9.trend).icon}
                    </span>
                    <span className={`font-medium ${getTrendIcon(phq9.trend).color}`}>
                      {getTrendIcon(phq9.trend).text}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {phq9.scores.length} evaluaciones
                  </p>
                </div>

                {/* GAD-7 */}
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-5 border-2 border-teal-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">GAD-7 (Ansiedad)</p>
                      <p className="text-3xl font-bold text-teal-600">
                        {gad7Avg} <span className="text-lg text-gray-500">/ 21</span>
                      </p>
                    </div>
                    <button
                      onClick={() => showInfoModal('gad7')}
                      className="text-2xl hover:scale-110 transition"
                      title="Más información"
                    >
                      ℹ️
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={getTrendIcon(gad7.trend).color}>
                      {getTrendIcon(gad7.trend).icon}
                    </span>
                    <span className={`font-medium ${getTrendIcon(gad7.trend).color}`}>
                      {getTrendIcon(gad7.trend).text}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {gad7.scores.length} evaluaciones
                  </p>
                </div>

              </div>

              {/* Estadísticas adicionales */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-800">
                    {phq9.scores.length + gad7.scores.length}
                  </p>
                  <p className="text-xs text-gray-600">Total evaluaciones</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-800">
                    {phq9.scores.length > 0 ? Math.min(...phq9.scores) : '-'}
                  </p>
                  <p className="text-xs text-gray-600">PHQ-9 mínimo</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-800">
                    {gad7.scores.length > 0 ? Math.min(...gad7.scores) : '-'}
                  </p>
                  <p className="text-xs text-gray-600">GAD-7 mínimo</p>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

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
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05"/>
                    </linearGradient>
                    <linearGradient id="gad7Gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Área PHQ-9 */}
                  {phq9.scores.length > 0 && (
                    <polygon
                      points={`
                        0,100 
                        ${phq9.scores.map((score, index) => {
                          const x = (index / Math.max(phq9.scores.length - 1, 1)) * 100;
                          const y = 100 - (score / 27) * 100;
                          return `${x},${y}`;
                        }).join(' ')}
                        100,100
                      `}
                      fill="url(#phq9Gradient)"
                    />
                  )}
                  
                  {/* Área GAD-7 */}
                  {gad7.scores.length > 0 && (
                    <polygon
                      points={`
                        0,100 
                        ${gad7.scores.map((score, index) => {
                          const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                          const y = 100 - (score / 27) * 100;
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
                        const y = 100 - (score / 27) * 100;
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
                    const y = 100 - (score / 27) * 100;
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
                  
                  {/* Línea GAD-7 */}
                  {gad7.scores.length > 1 && (
                    <polyline
                      points={gad7.scores.map((score, index) => {
                        const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                        const y = 100 - (score / 27) * 100;
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
                    const y = 100 - (score / 27) * 100;
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
                      y={100 - (hoveredPoint.score / 27) * 100 - 25}
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
                {(phq9.dates.length > 0 ? phq9.dates : gad7.dates).slice(0, 6).map((date, index, arr) => (
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

        {/* Gráficas de barras lado a lado */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          
          {/* PHQ-9 Barras */}
          {phq9.scores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">📋 PHQ-9 Detallado</h3>
                <button
                  onClick={() => showInfoModal('phq9')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Ver rangos
                </button>
              </div>
              
              <div className="relative h-56 flex items-end justify-around gap-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                {phq9.scores.slice(-8).map((score, index) => {
                  const percentage = (score / 27) * 100;
                  let barColor = 'from-green-500 to-green-400';
                  if (score >= 20) barColor = 'from-red-600 to-red-500';
                  else if (score >= 15) barColor = 'from-orange-500 to-orange-400';
                  else if (score >= 10) barColor = 'from-yellow-500 to-yellow-400';
                  else if (score >= 5) barColor = 'from-blue-500 to-blue-400';
                  
                  return (
                    <div key={index} className="flex flex-col items-center justify-end flex-1 h-full group">
                      <div 
                        className={`w-full bg-gradient-to-t ${barColor} rounded-t-lg transition-all hover:scale-110 cursor-pointer shadow-lg`}
                        style={{ 
                          height: `${percentage}%`,
                          minHeight: '8px'
                        }}
                        title={`PHQ-9: ${score}/27 - ${new Date(phq9.dates[index]).toLocaleDateString('es-ES')}`}
                      />
                      <span className="text-xs text-gray-700 mt-2 font-bold group-hover:text-blue-600">{score}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Promedio: <span className="font-bold text-blue-600">{phq9Avg}/27</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* GAD-7 Barras */}
          {gad7.scores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">📊 GAD-7 Detallado</h3>
                <button
                  onClick={() => showInfoModal('gad7')}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                >
                  Ver rangos
                </button>
              </div>
              
              <div className="relative h-56 flex items-end justify-around gap-2 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-4">
                {gad7.scores.slice(-8).map((score, index) => {
                  const percentage = (score / 21) * 100;
                  let barColor = 'from-green-500 to-green-400';
                  if (score >= 15) barColor = 'from-red-600 to-red-500';
                  else if (score >= 10) barColor = 'from-yellow-500 to-yellow-400';
                  else if (score >= 5) barColor = 'from-teal-500 to-teal-400';
                  
                  return (
                    <div key={index} className="flex flex-col items-center justify-end flex-1 h-full group">
                      <div 
                        className={`w-full bg-gradient-to-t ${barColor} rounded-t-lg transition-all hover:scale-110 cursor-pointer shadow-lg`}
                        style={{ 
                          height: `${percentage}%`,
                          minHeight: '8px'
                        }}
                        title={`GAD-7: ${score}/21 - ${new Date(gad7.dates[index]).toLocaleDateString('es-ES')}`}
                      />
                      <span className="text-xs text-gray-700 mt-2 font-bold group-hover:text-teal-600">{score}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Promedio: <span className="font-bold text-teal-600">{gad7Avg}/21</span>
                </p>
              </div>
            </motion.div>
          )}

        </div>

        {/* Recomendaciones mejoradas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-3xl shadow-2xl p-8"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">
              💡 Recomendaciones Personalizadas
            </h3>
            <button
              onClick={() => showInfoModal('recommendations')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver guía completa →
            </button>
          </div>

          <div className={`p-6 rounded-xl border-2 ${
            overall.status === 'excellent' ? 'bg-green-50 border-green-300' :
            overall.status === 'good' ? 'bg-blue-50 border-blue-300' :
            overall.status === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
            'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-4">
              <span className="text-4xl">
                {overall.status === 'excellent' ? '✅' :
                overall.status === 'good' ? '👍' :
                overall.status === 'moderate' ? '⚠️' : '🚨'}
              </span>
              <div className="flex-1">
                {overall.status === 'excellent' && (
                  <>
                    <p className="font-bold text-green-900 mb-2">¡Excelente trabajo!</p>
                    <p className="text-green-800 mb-3">
                      Estás manteniendo un muy buen estado de bienestar mental. Continúa con tus hábitos saludables.
                    </p>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Mantén tu rutina de autocuidado</li>
                      <li>• Practica actividades que disfrutes</li>
                      <li>• Comparte tu bienestar con otros</li>
                    </ul>
                  </>
                )}
                {overall.status === 'good' && (
                  <>
                    <p className="font-bold text-blue-900 mb-2">Vas por buen camino</p>
                    <p className="text-blue-800 mb-3">
                      Tu bienestar está en buen estado. Considera fortalecer tus rutinas de autocuidado.
                    </p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Establece una rutina de sueño consistente</li>
                      <li>• Incorpora ejercicio regular</li>
                      <li>• Practica técnicas de relajación</li>
                    </ul>
                  </>
                )}
                {overall.status === 'moderate' && (
                  <>
                    <p className="font-bold text-yellow-900 mb-2">Es momento de actuar</p>
                    <p className="text-yellow-800 mb-3">
                      Tus niveles sugieren que debes enfocarte más en tu bienestar emocional.
                    </p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Aumenta actividades de autocuidado</li>
                      <li>• Practica técnicas de manejo del estrés</li>
                      <li>• Considera hablar con alguien de confianza</li>
                    </ul>
                  </>
                )}
                {(overall.status === 'concerning' || overall.status === 'critical') && (
                  <>
                    <p className="font-bold text-red-900 mb-2">Necesitas apoyo profesional</p>
                    <p className="text-red-800 mb-3">
                      Tus resultados indican que sería beneficioso buscar ayuda profesional de inmediato.
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