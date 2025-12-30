import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BackgroundMusic from '../components/BackgroundMusic';
import FaceMonitor from '../components/FaceMonitor';
import Camera from '../components/Camera';
import api from '../services/api';
import useDynamicTheme from '../hooks/useDynamicTheme';

// Importar sistema de recomendaciones
import { 
  getRecommendations, 
  getPersonalizedMessage, 
  shouldShowNotification 
} from '../utils/recommendationSystem';

// Importar componentes de notificaciones
import { 
  ToastNotification, 
  RecommendationModal, 
  FloatingBadge,
  MiniToast 
} from '../components/RecommendationNotifications';

function Home() {
  const navigate = useNavigate();
  const { theme, isThemeLoading, scores, emotionalState } = useDynamicTheme();

  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState(null);
  const [lastScores, setLastScores] = useState({ phq9: null, gad7: null });

  // Estados para recomendaciones
  const [recommendations, setRecommendations] = useState([]);
  const [personalizedMessage, setPersonalizedMessage] = useState(null);
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [showToastNotification, setShowToastNotification] = useState(false);
  const [showMiniToast, setShowMiniToast] = useState(false);
  const [currentToastExercise, setCurrentToastExercise] = useState(null);
  const [toastPosition, setToastPosition] = useState('bottom-right');

  useEffect(() => {
    loadUserData();
  }, []);

  // Mantener lastScores alineado con el hook (para recomendaciones)
  useEffect(() => {
    if (!scores) return;
    setLastScores({
      phq9: scores.phq9 ?? null,
      gad7: scores.gad7 ?? null,
    });
  }, [scores]);

  // Generar recomendaciones cuando cambian los scores
  useEffect(() => {
    if (lastScores.phq9 !== null || lastScores.gad7 !== null) {
      generateRecommendations();
    }
  }, [lastScores]);

  // Sistema de notificaciones automáticas
  useEffect(() => {
    if (recommendations.length > 0) {
      const lastShown = localStorage.getItem('last_recommendation_shown');
      const shouldShow = shouldShowNotification(
        lastShown ? parseInt(lastShown) : null,
        30 // Mostrar cada 30 minutos
      );

      if (shouldShow) {
        const notificationType = Math.random();
        
        if (notificationType < 0.4) {
          // 40% - Toast lateral
          showRandomToast();
        } else if (notificationType < 0.7) {
          // 30% - Mini toast superior
          setShowMiniToast(true);
          setTimeout(() => setShowMiniToast(false), 10000);
        }

        localStorage.setItem('last_recommendation_shown', Date.now().toString());
      }
    }
  }, [recommendations]);

  const loadUserData = async () => {
    try {
      const storedUserId = localStorage.getItem('user_id');
      const storedUserName = localStorage.getItem('user_name');
      
      if (!storedUserId || !storedUserName) {
        navigate('/');
        return;
      }
      
      setUserId(parseInt(storedUserId));
      setUserName(storedUserName);

    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  };

  const generateRecommendations = () => {
    const recs = getRecommendations(lastScores.phq9, lastScores.gad7, {
      maxRecommendations: 3
    });
    
    const message = getPersonalizedMessage(lastScores.phq9, lastScores.gad7);
    
    setRecommendations(recs);
    setPersonalizedMessage(message);
  };

  const showRandomToast = () => {
    if (recommendations.length === 0) return;
    
    const randomExercise = recommendations[Math.floor(Math.random() * recommendations.length)];
    const positions = ['top-right', 'bottom-right', 'bottom-left'];
    const randomPosition = positions[Math.floor(Math.random() * positions.length)];
    
    setCurrentToastExercise(randomExercise);
    setToastPosition(randomPosition);
    setShowToastNotification(true);
    
    setTimeout(() => {
      setShowToastNotification(false);
    }, 15000);
  };

  // ============================================================
  // LOGOUT OPTIMIZADO - NO BLOQUEA LA UI
  // ============================================================
  const handleLogout = () => {
    const userId = localStorage.getItem('user_id');
    
    // 1. PRIMERO: Limpiar localStorage INMEDIATAMENTE (operación síncrona)
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');
    localStorage.removeItem('last_recommendation_shown');
    
    console.log('🧹 LocalStorage limpiado');
    
    // 2. SEGUNDO: Navegar INMEDIATAMENTE (no esperar backend)
    navigate('/');
    
    // 3. TERCERO: Cerrar sesión en BD en BACKGROUND (fire-and-forget)
    if (userId) {
      console.log('🔄 Cerrando sesión en BD (background)...');
      
      // No usar await - ejecutar en background sin bloquear
      api.post('/session/end', {
        user_id: parseInt(userId)
      })
      .then(() => {
        console.log('✅ Sesión cerrada en BD');
      })
      .catch((error) => {
        console.error('⚠️ Error al cerrar sesión en BD:', error);
        // No importa si falla, el usuario ya cerró sesión localmente
      });
    }
  };

  if (isThemeLoading || !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-600">Cargando tu espacio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.colors.primary} transition-all duration-1000 p-6 relative`}>
      
      {/* Monitor de rostro continuo (oculto) */}
      <FaceMonitor isActive={true} />

      {/* Música de fondo */}
      <BackgroundMusic musicFile={theme.music} volume={0.2} />

      {/* ========================================
          SISTEMA DE NOTIFICACIONES
          ======================================== */}
      
      {/* Toast Notification (esquinas) */}
      {currentToastExercise && (
        <ToastNotification
          exercise={currentToastExercise}
          isVisible={showToastNotification}
          onClose={() => setShowToastNotification(false)}
          position={toastPosition}
        />
      )}

      {/* Modal de Recomendaciones (centro) */}
      {personalizedMessage && (
        <RecommendationModal
          exercises={recommendations}
          isOpen={showRecommendationModal}
          onClose={() => setShowRecommendationModal(false)}
          personalizedMessage={personalizedMessage}
        />
      )}

      {/* Badge Flotante - Siempre visible si hay recomendaciones */}
      {recommendations.length > 0 && (
        <FloatingBadge
          count={recommendations.length}
          onClick={() => setShowRecommendationModal(true)}
          position="top-right"
        />
      )}

      {/* Mini Toast Superior */}
      <MiniToast
        message="Tenemos recomendaciones para ti ✨"
        isVisible={showMiniToast}
        onClose={() => setShowMiniToast(false)}
        onClick={() => {
          setShowMiniToast(false);
          setShowRecommendationModal(true);
        }}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="px-1 py-1">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white text-outline-black mb-2"
          >
            ¡Hola, {userName}! 👋
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/90 text-lg drop-shadow-sm"
          >
            {theme.welcomeMessage}
          </motion.p>
        </div>

        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-ui-sm font-semibold transition shadow-card hover:shadow-elevated"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* 🚨 Panel de emergencia (usa tools/emergencyNumber del tema) */}
      {theme?.emergency && (
        <div
          className={`${theme?.colors?.card || "bg-red-50/95 border-4 border-red-500"} rounded-ui-lg shadow-elevated p-6 mb-8`}
          role="alert"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className={`text-lg font-bold ${theme?.colors?.accent || "text-red-700"}`}>
                {theme?.name || "🚨 ALTO RIESGO"}
              </p>
              <p className={`${theme?.colors?.text || "text-gray-900"} text-sm mt-1`}>
                Si necesitas ayuda inmediata, contacta una línea de apoyo o a alguien de confianza.
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
                        className={`px-4 py-2 rounded-ui-sm text-white font-semibold bg-gradient-to-r ${theme?.colors?.button || "from-red-600 to-red-700"}`}
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
        </div>
      )}

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto">
        
        {/* Grid de cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* Card Tests Psicológicos */}
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-ui-lg shadow-elevated p-8 hover:scale-105 transition-transform duration-300`}>
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Tests Psicológicos
              </h2>
              <p className="text-gray-600 mb-6">
                Evalúa tu estado emocional actual con cuestionarios validados
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/phq9')}
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-ui-sm font-semibold hover:shadow-card transition flex items-center justify-between`}
                >
                  <span className="flex items-center gap-2">
                    <span>😔</span>
                    <span>Test PHQ-9 (Depresión)</span>
                  </span>
                  {lastScores.phq9 !== null && (
                    <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                      {lastScores.phq9}/27
                    </span>
                  )}
                </button>

                <button
                  onClick={() => navigate('/gad7')}
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-ui-sm font-semibold hover:shadow-card transition flex items-center justify-between`}
                >
                  <span className="flex items-center gap-2">
                    <span>😰</span>
                    <span>Test GAD-7 (Ansiedad)</span>
                  </span>
                  {lastScores.gad7 !== null && (
                    <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                      {lastScores.gad7}/21
                    </span>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                ⏱️ Cada test toma aproximadamente 2-3 minutos
              </p>
            </div>
          </div>

          {/* Card Dashboard */}
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-ui-lg shadow-elevated p-8 hover:scale-105 transition-transform duration-300`}>
            <div className="text-center">
              <div className="text-6xl mb-4">📈</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Mi Progreso
              </h2>
              <p className="text-gray-600 mb-6">
                Visualiza tu evolución emocional a lo largo del tiempo
              </p>

              <button
                onClick={() => navigate('/dashboard')}
                className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-ui-sm font-semibold hover:shadow-card transition mb-4`}
              >
                Ver estadísticas completas
              </button>

              {lastScores.phq9 !== null && (
                <div className="bg-white/50 rounded-ui-sm p-4 text-left">
                  <p className="text-sm text-gray-600 mb-2">Vista rápida:</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">PHQ-9</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(lastScores.phq9 / 27) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    {lastScores.gad7 !== null && (
                      <div>
                        <p className="text-xs text-gray-500">GAD-7</p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${(lastScores.gad7 / 21) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Ejercicios de Voz - CONDICIONAL SEGÚN TESTS */}
        <div className={`${theme.colors.card} backdrop-blur-sm rounded-ui-lg shadow-elevated p-8`}>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Ejercicios de Voz y Respiración
            </h3>
            <p className="text-gray-600 text-sm">
              Técnicas guiadas para mejorar tu bienestar emocional
            </p>
          </div>

          {/* ✅ NUEVO: Verificar si tiene tests realizados */}
          {lastScores.phq9 === null && lastScores.gad7 === null ? (
            // NO tiene tests - Mostrar mensaje de recomendación
            <div className="text-center py-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-7xl mb-6"
              >
                📋
              </motion.div>
              
              <h4 className="text-2xl font-bold text-gray-800 mb-4">
                Completa tu primera evaluación
              </h4>
              
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Para acceder a ejercicios personalizados según tu estado emocional, 
                primero necesitas completar los tests psicológicos.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/phq9')}
                  className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-ui-sm font-bold transition shadow-card hover:shadow-elevated"
                >
                  Comenzar con PHQ-9
                </button>
                
                <button
                  onClick={() => navigate('/gad7')}
                  className="px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-ui-sm font-bold transition shadow-card hover:shadow-elevated"
                >
                  Comenzar con GAD-7
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-ui-md inline-block">
                <p className="text-sm text-blue-800">
                  ⏱️ <strong>Solo toma 5-6 minutos</strong> completar ambos tests
                </p>
              </div>
            </div>
          ) : (
            // SÍ tiene tests - Mostrar ejercicios
            <>
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Tarjeta de Ansiedad */}
                <motion.button
                  onClick={() => navigate('/exercises/anxiety')}
                  className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-ui-lg p-8 border-3 border-blue-300 hover:border-blue-500 shadow-card hover:shadow-elevated transition-all duration-300 text-left overflow-hidden"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Icono decorativo de fondo */}
                  <div className="absolute -right-8 -bottom-8 text-blue-200 opacity-20 text-9xl">
                    🧠
                  </div>

                  <div className="relative z-10">
                    {/* Icono principal */}
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-ui-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-card">
                      <span className="text-4xl">🧠</span>
                    </div>

                    {/* Título */}
                    <h4 className="text-2xl font-bold text-gray-800 mb-3">
                      Recursos de Ansiedad
                    </h4>

                    {/* Descripción */}
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      Técnicas de respiración, lectura consciente y práctica vocal para reducir la ansiedad
                    </p>

                    {/* Badge de ejercicios */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                        3 ejercicios
                      </span>
                      <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                        5-7 min
                      </span>
                    </div>

                    {/* Flecha */}
                    <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                      <span>Comenzar ejercicios</span>
                      <span className="text-2xl ml-2">→</span>
                    </div>
                  </div>
                </motion.button>

                {/* Tarjeta de Depresión */}
                <motion.button
                  onClick={() => navigate('/exercises/depression')}
                  className="group relative bg-gradient-to-br from-amber-50 to-amber-100 rounded-ui-lg p-8 border-3 border-amber-300 hover:border-amber-500 shadow-card hover:shadow-elevated transition-all duration-300 text-left overflow-hidden"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Icono decorativo de fondo */}
                  <div className="absolute -right-8 -bottom-8 text-amber-200 opacity-20 text-9xl">
                    ❤️
                  </div>

                  <div className="relative z-10">
                    {/* Icono principal */}
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-ui-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-card">
                      <span className="text-4xl">❤️</span>
                    </div>

                    {/* Título */}
                    <h4 className="text-2xl font-bold text-gray-800 mb-3">
                      Recursos de Depresión
                    </h4>

                    {/* Descripción */}
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      Lectura prosódica, afirmaciones vocales y diálogo guiado para elevar el ánimo
                    </p>

                    {/* Badge de ejercicios */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-semibold">
                        3 ejercicios
                      </span>
                      <span className="px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-semibold">
                        6-10 min
                      </span>
                    </div>

                    {/* Flecha */}
                    <div className="flex items-center text-amber-600 font-semibold group-hover:translate-x-2 transition-transform">
                      <span>Comenzar ejercicios</span>
                      <span className="text-2xl ml-2">→</span>
                    </div>
                  </div>
                </motion.button>

              </div>

              {/* Nota informativa */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-ui-md">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">💡</span>
                  <div>
                    <p className="text-sm text-gray-700">
                      <strong>¿Cómo funciona?</strong> Los ejercicios utilizan análisis de voz en tiempo real para 
                      evaluar tu estado emocional y brindarte retroalimentación personalizada.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default Home;