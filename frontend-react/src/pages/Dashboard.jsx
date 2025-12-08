import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import FaceMonitor from '../components/FaceMonitor'; // ← AGREGAR

function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [trendsData, setTrendsData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      const name = localStorage.getItem('user_name');
      
      if (!userId) {
        navigate('/');
        return;
      }
      
      setUserName(name);
      
      // Cargar análisis de tendencias
      const response = await api.get(`/trends/analyze/${userId}?days=30`);
      setTrendsData(response.data);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
        <div className="text-2xl font-semibold text-gray-700">Cargando dashboard...</div>
      </div>
    );
  }

  if (!trendsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            No hay datos suficientes
          </h2>
          <p className="text-gray-600 mb-6">
            Necesitas completar al menos un test para ver tus estadísticas
          </p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
          >
            Ir al Home
          </button>
        </div>
      </div>
    );
  }

  const { phq9, gad7, overall } = trendsData;

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
    if (trend === 'improving') return '📈 Mejorando';
    if (trend === 'worsening') return '📉 Empeorando';
    return '➡️ Estable';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 p-6">

      <FaceMonitor isActive={true} />
      
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600 text-lg">
              Análisis de tus últimos 30 días
            </p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition shadow-md"
          >
            ← Volver
          </button>
        </div>

        {/* Score General */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Estado General
            </h2>
            <div className="relative inline-block">
              <svg className="w-48 h-48">
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
                  transform="rotate(-90 96 96)"
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
            <div className={`mt-6 inline-block px-6 py-3 bg-gradient-to-r ${getStatusColor(overall.status)} text-white rounded-full font-bold text-lg shadow-lg`}>
              {getStatusText(overall.status)}
            </div>
          </div>
        </div>

        {/* Tendencias PHQ-9 y GAD-7 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          
          {/* PHQ-9 */}
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">PHQ-9 (Depresión)</h3>
              <span className="text-3xl">📋</span>
            </div>
            
            {phq9.scores.length > 0 ? (
              <>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Tendencia:</span>
                    <span className="font-semibold text-gray-800">{getTrendIcon(phq9.trend)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Promedio:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {(phq9.scores.reduce((a, b) => a + b, 0) / phq9.scores.length).toFixed(1)} / 27
                    </span>
                  </div>
                </div>
                
                {/* Gráfica simple */}
                <div className="relative h-40 flex items-end justify-around gap-2 bg-gray-50 rounded-lg p-4">
                  {phq9.scores.map((score, index) => {
                    const percentage = (score / 27) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center justify-end flex-1 h-full">
                        <div 
                          className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg transition-all hover:scale-110"
                          style={{ 
                            height: `${percentage}%`,
                            minHeight: '4px'
                          }}
                          title={`Score: ${score}`}
                        />
                        <span className="text-xs text-gray-600 mt-1 font-semibold">{score}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 text-center text-xs text-gray-500">
                  {phq9.scores.length} evaluaciones en 30 días
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay datos de PHQ-9
              </div>
            )}
          </div>

          {/* GAD-7 */}
          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">GAD-7 (Ansiedad)</h3>
              <span className="text-3xl">📊</span>
            </div>
            
            {gad7.scores.length > 0 ? (
              <>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Tendencia:</span>
                    <span className="font-semibold text-gray-800">{getTrendIcon(gad7.trend)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Promedio:</span>
                    <span className="text-2xl font-bold text-teal-600">
                      {(gad7.scores.reduce((a, b) => a + b, 0) / gad7.scores.length).toFixed(1)} / 21
                    </span>
                  </div>
                </div>
                
                {/* Gráfica simple */}
                <div className="relative h-40 flex items-end justify-around gap-2 bg-gray-50 rounded-lg p-4">
                  {gad7.scores.map((score, index) => {
                    const percentage = (score / 21) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center justify-end flex-1 h-full">
                        <div 
                          className="w-full bg-gradient-to-t from-teal-500 to-teal-300 rounded-t-lg transition-all hover:scale-110"
                          style={{ 
                            height: `${percentage}%`,
                            minHeight: '4px'
                          }}
                          title={`Score: ${score}`}
                        />
                        <span className="text-xs text-gray-600 mt-1 font-semibold">{score}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 text-center text-xs text-gray-500">
                  {gad7.scores.length} evaluaciones en 30 días
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay datos de GAD-7
              </div>
            )}
          </div>

        </div>

        {/* Gráfica Lineal Comparativa */}
        {(phq9.scores.length > 0 || gad7.scores.length > 0) && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Evolucion de tus Evaluaciones
            </h3>
            
            <div className="relative h-96 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-8">
              {/* Eje Y - Escala */}
              <div className="absolute left-4 top-8 bottom-20 flex flex-col justify-between text-sm text-gray-600 font-medium">
                <span>27</span>
                <span>20</span>
                <span>15</span>
                <span>10</span>
                <span>5</span>
                <span>0</span>
              </div>
              
              {/* Líneas de cuadrícula horizontales */}
              <div className="absolute left-16 right-8 top-8 bottom-20">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="absolute w-full border-t border-gray-300"
                    style={{ top: `${i * 20}%` }}
                  />
                ))}
              </div>
              
              {/* Contenedor de gráfica */}
              <div className="absolute left-16 right-8 top-8 bottom-20">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    {/* Gradiente para área bajo PHQ-9 */}
                    <linearGradient id="phq9Gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05"/>
                    </linearGradient>
                    
                    {/* Gradiente para área bajo GAD-7 */}
                    <linearGradient id="gad7Gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Área bajo la línea PHQ-9 */}
                  {phq9.scores.length > 0 && (
                    <polygon
                      points={`
                        0,100 
                        ${phq9.scores.map((score, index) => {
                          const x = (index / Math.max(phq9.scores.length - 1, 1)) * 100;
                          const y = 100 - (score / 27) * 100;
                          return `${x},${y}`;
                        }).join(' ')}
                        ${(phq9.scores.length - 1) / Math.max(phq9.scores.length - 1, 1) * 100},100
                      `}
                      fill="url(#phq9Gradient)"
                    />
                  )}
                  
                  {/* Área bajo la línea GAD-7 */}
                  {gad7.scores.length > 0 && (
                    <polygon
                      points={`
                        0,100 
                        ${gad7.scores.map((score, index) => {
                          const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                          const y = 100 - (score / 27) * 100;
                          return `${x},${y}`;
                        }).join(' ')}
                        ${(gad7.scores.length - 1) / Math.max(gad7.scores.length - 1, 1) * 100},100
                      `}
                      fill="url(#gad7Gradient)"
                    />
                  )}
                  
                  {/* Línea PHQ-9 */}
                  {phq9.scores.length > 1 && (
                    <polyline
                      points={phq9.scores.map((score, index) => {
                        const x = (index / (phq9.scores.length - 1)) * 100;
                        const y = 100 - (score / 27) * 100;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="0.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  
                  {/* Puntos PHQ-9 */}
                  {phq9.scores.map((score, index) => {
                    const x = (index / Math.max(phq9.scores.length - 1, 1)) * 100;
                    const y = 100 - (score / 27) * 100;
                    return (
                      <circle
                        key={`phq9-${index}`}
                        cx={x}
                        cy={y}
                        r="1.2"
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="0.3"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  
                  {/* Línea GAD-7 */}
                  {gad7.scores.length > 1 && (
                    <polyline
                      points={gad7.scores.map((score, index) => {
                        const x = (index / (gad7.scores.length - 1)) * 100;
                        const y = 100 - (score / 27) * 100;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="0.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  
                  {/* Puntos GAD-7 */}
                  {gad7.scores.map((score, index) => {
                    const x = (index / Math.max(gad7.scores.length - 1, 1)) * 100;
                    const y = 100 - (score / 27) * 100;
                    return (
                      <circle
                        key={`gad7-${index}`}
                        cx={x}
                        cy={y}
                        r="1.2"
                        fill="#14b8a6"
                        stroke="white"
                        strokeWidth="0.3"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
              </div>
              
              {/* Etiquetas del eje X */}
              <div className="absolute left-16 right-8 bottom-12 flex justify-between text-sm text-gray-600">
                {phq9.dates.length > 0 ? (
                  phq9.dates.map((date, index) => (
                    <span key={index} className="text-xs">
                      {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  ))
                ) : gad7.dates.length > 0 ? (
                  gad7.dates.map((date, index) => (
                    <span key={index} className="text-xs">
                      {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  ))
                ) : null}
              </div>
              
              {/* Leyenda en la esquina superior derecha */}
              <div className="absolute top-8 right-8 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-gray-200">
                <div className="flex flex-col gap-2 text-sm">
                  {phq9.scores.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="font-medium text-gray-700">
                        PHQ-9: {phq9.scores[phq9.scores.length - 1]}
                      </span>
                    </div>
                  )}
                  {gad7.scores.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                      <span className="font-medium text-gray-700">
                        GAD-7: {gad7.scores[gad7.scores.length - 1]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Info inferior */}
            <div className="mt-4 flex justify-between items-center text-sm">
              <span className="text-gray-500">
                De {phq9.scores.length + gad7.scores.length} evaluaciones completadas
              </span>
              <span className="text-blue-600 font-medium">
                — Estable
              </span>
            </div>
          </div>
        )}

        {/* Recomendaciones */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            Recomendaciones
          </h3>
          <div className="space-y-3">
            {overall.status === 'excellent' && (
              <p className="text-gray-700">✅ Excelente trabajo manteniendo tu bienestar mental. Continúa con tus hábitos saludables.</p>
            )}
            {overall.status === 'good' && (
              <p className="text-gray-700">👍 Tu bienestar está en buen estado. Mantén tus rutinas de autocuidado.</p>
            )}
            {overall.status === 'moderate' && (
              <p className="text-gray-700">⚠️ Considera aumentar tus actividades de autocuidado y técnicas de manejo del estrés.</p>
            )}
            {(overall.status === 'concerning' || overall.status === 'critical') && (
              <p className="text-red-700 font-semibold">🚨 Te recomendamos contactar con un profesional de salud mental. Línea de ayuda: 952</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;