import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmotionalState, getTheme } from '../utils/themeSystem';
import BackgroundMusic from '../components/BackgroundMusic';
import FaceMonitor from '../components/FaceMonitor';
import Camera from '../components/Camera';
import api from '../services/api';

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

// Modal personalizado genérico
const Modal = ({ isOpen, onClose, title, children, icon = 'ℹ️' }) => {
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
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function Home() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState(null);
  const [emotionalState, setEmotionalState] = useState('sin_evaluacion');
  const [theme, setTheme] = useState(null);
  const [lastScores, setLastScores] = useState({ phq9: null, gad7: null });
  const [showMirror, setShowMirror] = useState(false);

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
      
      const state = getEmotionalState(phq9Score, gad7Score);
      setEmotionalState(state);
      setTheme(getTheme(state));
      
    } catch (error) {
      console.error('Error al cargar scores:', error);
      setLastScores({ phq9: null, gad7: null });
      setEmotionalState('sin_evaluacion');
      setTheme(getTheme('sin_evaluacion'));
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

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');
    localStorage.removeItem('last_recommendation_shown');
    navigate('/');
  };

  if (!theme) {
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

      {/* Botón flotante del espejo */}
      <button
        onClick={() => setShowMirror(!showMirror)}
        className={`fixed right-6 top-1/2 -translate-y-1/2 z-40 w-16 h-16 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ${
          showMirror 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
        } hover:scale-110`}
        title={showMirror ? 'Ocultar espejo' : 'Ver espejo'}
      >
        <span className="text-3xl">{showMirror ? '✕' : '🪞'}</span>
      </button>

      {/* Espejo virtual GRANDE */}
      <AnimatePresence>
        {showMirror && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowMirror(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border-8 border-blue-500 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del espejo */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <span>🪞</span>
                      <span>Espejo Virtual</span>
                    </h3>
                    <p className="text-white/80 text-sm">Tu reflejo en tiempo real</p>
                  </div>
                  <button
                    onClick={() => setShowMirror(false)}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition text-xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Cámara con altura reducida */}
              <div className="relative bg-gray-900 h-[400px]">
                <Camera 
                  onCapture={() => {}} 
                  isActive={true}
                />
                
                {/* Overlay con consejos */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-3 text-white">
                  <p className="text-sm flex items-center gap-2">
                    <span>💡</span>
                    <span>Verifica tu postura y expresión facial</span>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-gray-800 mb-2"
          >
            ¡Hola, {userName}! 👋
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 text-lg"
          >
            {theme.welcomeMessage}
          </motion.p>
        </div>

        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition shadow-lg hover:shadow-xl"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto">
        
        {/* Grid de cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* Card Tests Psicológicos */}
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8 hover:scale-105 transition-transform duration-300`}>
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
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-between`}
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
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-between`}
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
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8 hover:scale-105 transition-transform duration-300`}>
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
                className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition mb-4`}
              >
                Ver estadísticas completas
              </button>

              {lastScores.phq9 !== null && (
                <div className="bg-white/50 rounded-lg p-4 text-left">
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

        {/* Ejercicios de Voz - SECCIÓN COMPLETA */}
        <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8`}>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Ejercicios de Voz y Respiración
            </h3>
            <p className="text-gray-600 text-sm">
              Técnicas guiadas para mejorar tu bienestar emocional
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Tarjeta de Ansiedad */}
            <motion.button
              onClick={() => navigate('/exercises/anxiety')}
              className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-3 border-blue-300 hover:border-blue-500 hover:shadow-2xl transition-all duration-300 text-left overflow-hidden"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icono decorativo de fondo */}
              <div className="absolute -right-8 -bottom-8 text-blue-200 opacity-20 text-9xl">
                🧠
              </div>

              <div className="relative z-10">
                {/* Icono principal */}
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
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
              className="group relative bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-8 border-3 border-amber-300 hover:border-amber-500 hover:shadow-2xl transition-all duration-300 text-left overflow-hidden"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icono decorativo de fondo */}
              <div className="absolute -right-8 -bottom-8 text-amber-200 opacity-20 text-9xl">
                ❤️
              </div>

              <div className="relative z-10">
                {/* Icono principal */}
                <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
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
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl">
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
        </div>

      </div>
    </div>
  );
}

export default Home;