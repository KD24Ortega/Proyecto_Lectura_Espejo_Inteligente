import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmotionalState, getTheme } from '../utils/themeSystem';
import BackgroundMusic from '../components/BackgroundMusic';
import FaceMonitor from '../components/FaceMonitor';
import Camera from '../components/Camera';
import api from '../services/api';

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
  const [showResources, setShowResources] = useState(false);
  const [infoModal, setInfoModal] = useState(null); // { title, content, icon }

  useEffect(() => {
    loadUserData();
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_recognition');
    navigate('/');
  };

  // Mostrar modal de información
  const showInfoModal = (title, content, icon = 'ℹ️') => {
    setInfoModal({ title, content, icon });
  };

  // Recursos de ayuda según el estado emocional
  const getResources = () => {
    const resources = {
      estable: [
        { 
          icon: '🧘', 
          title: 'Meditación guiada', 
          desc: 'Practica mindfulness diario', 
          action: () => window.open('https://www.youtube.com/results?search_query=meditacion+guiada', '_blank') 
        },
        { 
          icon: '📚', 
          title: 'Lecturas recomendadas', 
          desc: 'Artículos sobre bienestar', 
          action: () => window.open('https://www.who.int/es/news-room/fact-sheets/detail/mental-health-strengthening-our-response', '_blank') 
        },
        { 
          icon: '💪', 
          title: 'Ejercicios de respiración', 
          desc: 'Técnicas de relajación', 
          action: () => showInfoModal(
            'Ejercicio de Respiración 4-7-8',
            <div className="space-y-4">
              <p className="text-gray-700">
                La técnica 4-7-8 es un método de respiración respaldado por la ciencia que ayuda a reducir 
                la ansiedad y facilita el sueño. Fue desarrollada por el Dr. Andrew Weil.
              </p>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">1️⃣</span>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">Inhala por la nariz</p>
                    <p className="text-gray-600">Cuenta hasta <strong className="text-blue-600">4</strong> mientras respiras profundamente</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">2️⃣</span>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">Sostén la respiración</p>
                    <p className="text-gray-600">Mantén el aire en tus pulmones contando hasta <strong className="text-purple-600">7</strong></p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">3️⃣</span>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">Exhala por la boca</p>
                    <p className="text-gray-600">Suelta el aire lentamente contando hasta <strong className="text-green-600">8</strong></p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-4 border-2 border-blue-300">
                <p className="text-center font-bold text-gray-800 mb-2">📊 Patrón: 4 segundos - 7 segundos - 8 segundos</p>
                <p className="text-center text-sm text-gray-700">Repite este ciclo <strong>4 veces</strong> para obtener mejores resultados</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-green-900 mb-2">✨ Beneficios:</p>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Reduce la ansiedad y el estrés</li>
                  <li>• Ayuda a conciliar el sueño</li>
                  <li>• Calma el sistema nervioso</li>
                  <li>• Mejora la concentración</li>
                </ul>
              </div>

              <p className="text-xs text-center text-gray-500 italic">
                💡 Tip: Practica esta técnica 2 veces al día para mejores resultados
              </p>
            </div>,
            '🌬️'
          )
        }
      ],
      leve: [
        { 
          icon: '🎯', 
          title: 'Plan de autocuidado', 
          desc: 'Establece rutinas saludables', 
          action: () => navigate('/dashboard') 
        },
        { 
          icon: '📝', 
          title: 'Diario emocional', 
          desc: 'Registra cómo te sientes', 
          action: () => showInfoModal(
            'Diario Emocional',
            <div className="space-y-4">
              <p className="text-gray-700">El diario emocional es una herramienta poderosa para el autoconocimiento.</p>
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                <h4 className="font-bold text-gray-800 mb-3">Beneficios:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>✓ Identifica patrones emocionales</li>
                  <li>✓ Reduce el estrés al expresar sentimientos</li>
                  <li>✓ Mejora el autoconocimiento</li>
                  <li>✓ Facilita la comunicación con terapeutas</li>
                </ul>
              </div>
              <p className="text-sm text-gray-600 text-center italic">Esta función estará disponible próximamente en tu dashboard</p>
            </div>,
            '📖'
          )
        },
        { 
          icon: '🤝', 
          title: 'Grupos de apoyo', 
          desc: 'Conecta con otros', 
          action: () => window.open('https://www.mentalhealthamerica.net/find-support-groups', '_blank') 
        }
      ],
      moderado: [
        { 
          icon: '👨‍⚕️', 
          title: 'Buscar ayuda profesional', 
          desc: 'Encuentra un terapeuta', 
          action: () => window.open('https://www.psychologytoday.com/us/therapists', '_blank') 
        },
        { 
          icon: '📞', 
          title: 'Líneas de crisis', 
          desc: 'Apoyo inmediato 24/7', 
          action: () => showInfoModal(
            'Líneas de Crisis y Apoyo',
            <div className="space-y-4">
              <p className="text-gray-700">Si necesitas hablar con alguien de inmediato, estos servicios están disponibles 24/7:</p>
              <div className="space-y-3">
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
                  <p className="font-bold text-green-900 text-xl mb-2">🇪🇨 Ecuador</p>
                  <a href="tel:952" className="text-3xl font-bold text-green-700 hover:text-green-900">952</a>
                  <p className="text-sm text-gray-600 mt-2">Línea gratuita de apoyo emocional</p>
                </div>
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
                  <p className="font-bold text-blue-900 mb-2">Internacional</p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>🇺🇸 USA: 988 (Suicide & Crisis Lifeline)</li>
                    <li>🇪🇸 España: 024 (Línea de Atención)</li>
                    <li>🇲🇽 México: 800-290-0024</li>
                  </ul>
                </div>
              </div>
              <p className="text-center text-gray-600 font-semibold">No estás solo/a. Siempre hay alguien dispuesto a escucharte.</p>
            </div>,
            '📞'
          )
        },
        { 
          icon: '💊', 
          title: 'Información médica', 
          desc: 'Sobre tratamientos disponibles', 
          action: () => window.open('https://www.nimh.nih.gov/health/topics', '_blank') 
        }
      ],
      severo: [
        { 
          icon: '🚨', 
          title: 'Ayuda urgente', 
          desc: 'Contacto inmediato', 
          action: () => window.location.href = 'tel:952' 
        },
        { 
          icon: '🏥', 
          title: 'Centros de salud', 
          desc: 'Ubicaciones cercanas', 
          action: () => window.open('https://www.google.com/maps/search/centros+de+salud+mental/', '_blank') 
        },
        { 
          icon: '👥', 
          title: 'Red de apoyo', 
          desc: 'Contacta a tu red cercana', 
          action: () => showInfoModal(
            'Tu Red de Apoyo',
            <div className="space-y-4">
              <p className="text-gray-700">Es fundamental que hables con alguien de confianza sobre cómo te sientes.</p>
              <div className="space-y-3">
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
                  <h4 className="font-bold text-orange-900 mb-3">Personas de confianza:</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <span>👨‍👩‍👧</span>
                      <span>Familiar cercano</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>🤝</span>
                      <span>Amigo de confianza</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>👨‍⚕️</span>
                      <span>Médico de cabecera</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>🏫</span>
                      <span>Consejero escolar/universitario</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-center">
                <p className="font-bold text-red-900">Recuerda: No estás solo/a</p>
                <p className="text-sm text-red-700 mt-1">Pedir ayuda es un acto de valentía, no de debilidad</p>
              </div>
            </div>,
            '💙'
          )
        }
      ]
    };

    if (emotionalState === 'estable') return resources.estable;
    if (emotionalState === 'leve' || emotionalState === 'ansiedad_leve' || emotionalState === 'depresion_leve') return resources.leve;
    if (emotionalState.includes('moderado')) return resources.moderado;
    if (emotionalState.includes('severo') || emotionalState.includes('grave')) return resources.severo;
    
    return resources.estable;
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

      {/* Modal de información */}
      <Modal
        isOpen={infoModal !== null}
        onClose={() => setInfoModal(null)}
        title={infoModal?.title || ''}
        icon={infoModal?.icon}
      >
        {infoModal?.content}
      </Modal>

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

              {/* Footer compacto */}
              <div className="bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-600">
                  El espejo te ayuda a ser consciente de tu expresión durante las evaluaciones
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Modal de recursos */}
      <Modal
        isOpen={showResources}
        onClose={() => setShowResources(false)}
        title="Recursos de Apoyo"
        icon="🛠️"
      >
        <p className="text-gray-600 mb-6">
          Herramientas y recursos según tu estado actual: <span className="font-semibold text-blue-600">{theme.name}</span>
        </p>

        <div className="grid gap-4">
          {getResources().map((resource, index) => (
            <button
              key={index}
              onClick={() => {
                setShowResources(false);
                resource.action();
              }}
              className="p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition text-left group"
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl group-hover:scale-110 transition-transform">{resource.icon}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{resource.title}</h3>
                  <p className="text-sm text-gray-600">{resource.desc}</p>
                </div>
                <span className="text-blue-500 text-xl group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-gray-700 text-center">
            <strong>Recuerda:</strong> Estos recursos complementan, pero no reemplazan la ayuda profesional.
          </p>
        </div>
      </Modal>

      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
              ¡Hola, {userName}! 👋
            </h1>
            <p className="text-white/90 text-lg">
              Estado emocional: <span className="font-semibold">{theme.name}</span>
            </p>
            {lastScores.phq9 !== null && (
              <p className="text-white/80 text-sm mt-1">
                📊 PHQ-9: {lastScores.phq9}/27 | GAD-7: {lastScores.gad7 !== null ? `${lastScores.gad7}/21` : 'Pendiente'}
              </p>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl transition font-semibold border-2 border-white/30"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Alerta de emergencia */}
        {theme.emergency && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-100 border-4 border-red-500 rounded-2xl"
          >
            <div className="flex items-center gap-4">
              <span className="text-5xl animate-pulse">🚨</span>
              <div className="flex-1">
                <p className="text-2xl font-bold text-red-900 mb-2">
                  ATENCIÓN: Necesitas apoyo profesional urgente
                </p>
                <p className="text-red-700 mb-4">
                  Tus resultados indican que es importante que hables con un profesional de salud mental lo antes posible.
                </p>
                <div className="flex gap-3">
                  <a 
                    href="tel:952" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition shadow-lg"
                  >
                    <span>📞</span>
                    <span>Llamar Línea 952</span>
                  </a>
                  <button
                    onClick={() => setShowResources(true)}
                    className="px-6 py-3 bg-white border-2 border-red-600 text-red-600 rounded-full font-bold hover:bg-red-50 transition"
                  >
                    Ver recursos de ayuda
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          
          {/* Card Evaluaciones */}
          <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8 hover:scale-105 transition-transform duration-300`}>
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Evaluaciones
              </h2>
              <p className="text-gray-600 mb-6">
                {lastScores.phq9 === null && lastScores.gad7 === null
                  ? 'Realiza tu primera evaluación para obtener recomendaciones personalizadas'
                  : 'Mantén actualizado tu seguimiento emocional'
                }
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/phq9')}
                  className={`w-full px-6 py-4 bg-gradient-to-r ${theme.colors.button} text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-between`}
                >
                  <span className="flex items-center gap-2">
                    <span>📝</span>
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

        {/* Recursos de apoyo */}
        <div className={`${theme.colors.card} backdrop-blur-sm rounded-3xl shadow-2xl p-8`}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-1">
                Recursos de Apoyo
              </h3>
              <p className="text-gray-600 text-sm">
                Herramientas personalizadas según tu estado emocional
              </p>
            </div>
            <button
              onClick={() => setShowResources(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium"
            >
              Ver todos →
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {getResources().slice(0, 3).map((resource, index) => (
              <button
                key={index}
                onClick={resource.action}
                className="p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl group-hover:scale-110 transition-transform">{resource.icon}</span>
                  <h4 className="font-bold text-gray-800">{resource.title}</h4>
                </div>
                <p className="text-sm text-gray-600">{resource.desc}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Home;