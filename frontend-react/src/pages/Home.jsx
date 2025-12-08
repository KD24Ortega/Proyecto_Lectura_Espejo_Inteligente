import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmotionalState, getTheme } from '../utils/themeSystem';
import BackgroundMusic from '../components/BackgroundMusic';
import FaceMonitor from '../components/FaceMonitor'; // ← NUEVO
//import FaceMonitorRTC from "../components/FaceMonitorRTC";
import api from '../services/api';

function Home() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState(null);
  const [emotionalState, setEmotionalState] = useState('sin_evaluacion');
  const [theme, setTheme] = useState(null);
  const [lastScores, setLastScores] = useState({ phq9: null, gad7: null });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // ✅ Obtener user_id y user_name desde localStorage
      const storedUserId = localStorage.getItem('user_id');
      const storedUserName = localStorage.getItem('user_name');
      
      if (!storedUserId || !storedUserName) {
        // No hay sesión, regresar al login
        navigate('/');
        return;
      }
      
      setUserId(parseInt(storedUserId));
      setUserName(storedUserName);
      
      // ✅ Cargar scores desde la API
      await loadLastScores(storedUserId);
      
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      setTheme(getTheme('sin_evaluacion'));
    }
  };

  const loadLastScores = async (userId) => {
    try {
      const response = await api.get(`/assessments/last/${userId}`);
      
      const phq9Score = response.data.phq9.score;
      const gad7Score = response.data.gad7.score;

      setLastScores({ phq9: phq9Score, gad7: gad7Score });
      
      // ✅ Calcular estado emocional basado en scores reales
      const state = getEmotionalState(phq9Score, gad7Score);
      setEmotionalState(state);
      setTheme(getTheme(state));
      
    } catch (error) {
      console.error('Error al cargar scores:', error);
      // Si falla la API, usar estado sin evaluación
      setLastScores({ phq9: null, gad7: null });
      setEmotionalState('sin_evaluacion');
      setTheme(getTheme('sin_evaluacion'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');
    navigate('/');
  };

  if (!theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.colors.primary} transition-all duration-1000 p-6`}>
      
      {/*Monitor de rostro continuo */}
      <FaceMonitor isActive={true} />

      <BackgroundMusic musicFile={theme.music} volume={0.2} />

      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Hola, {userName}
            </h1>
            <p className="text-white/80 text-lg">
              Estado: <span className="font-semibold">{theme.name}</span>
            </p>
            {/* ✅ Mostrar scores si existen */}
            {lastScores.phq9 !== null && (
              <p className="text-white/70 text-sm mt-1">
                PHQ-9: {lastScores.phq9}/27 | GAD-7: {lastScores.gad7 !== null ? `${lastScores.gad7}/21` : 'Pendiente'}
              </p>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
          >
            Cerrar sesion
          </button>
        </div>

        {/* Alerta de emergencia */}
        {theme.emergency && (
          <div className="mb-8 p-6 bg-red-100 border-4 border-red-500 rounded-2xl">
            <p className="text-2xl font-bold text-red-900">
              ATENCION: Tus resultados indican que necesitas apoyo profesional
            </p>
            <a href="tel:952" className="inline-block mt-4 px-6 py-3 bg-red-600 text-white rounded-full font-bold">
              Llamar Linea 952
            </a>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Card Evaluaciones */}
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8 hover:scale-105 transition-transform duration-300`}>
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Evaluaciones
              </h2>
              <p className="text-gray-600 mb-6">
                {lastScores.phq9 === null && lastScores.gad7 === null
                  ? 'Realiza tu evaluacion para recibir recomendaciones personalizadas'
                  : 'Actualiza tus evaluaciones para mantener el seguimiento'
                }
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/phq9')}
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition`}
                >
                  Test PHQ-9
                  {lastScores.phq9 !== null && (
                    <span className="ml-2 text-sm">({lastScores.phq9}/27)</span>
                  )}
                </button>

                <button
                  onClick={() => navigate('/gad7')}
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition`}
                >
                  Test GAD-7
                  {lastScores.gad7 !== null && (
                    <span className="ml-2 text-sm">({lastScores.gad7}/21)</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card Dashboard */}
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8 hover:scale-105 transition-transform duration-300`}>
            <div className="text-center">
              <div className="text-6xl mb-4">📈</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Dashboard
              </h2>
              <p className="text-gray-600 mb-6">
                Visualiza tus estadisticas y progreso
              </p>

              <button
                onClick={() => navigate('/dashboard')}
                className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition`}
              >
                Ver estadisticas
              </button>
            </div>
          </div>

        </div>

        {/* Herramientas disponibles */}
        <div className={`mt-8 ${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8`}>
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Herramientas disponibles
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            {theme.tools.map((tool, index) => (
              <div
                key={index}
                className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 hover:shadow-lg transition cursor-pointer"
              >
                <p className="text-gray-700 font-semibold text-center">
                  {tool}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Home;