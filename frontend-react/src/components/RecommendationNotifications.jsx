import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import UnifiedModal from './UnifiedModal';

/**
 * Notificación Toast - Aparece en la esquina
 */
export const ToastNotification = ({ 
  exercise, 
  isVisible, 
  onClose, 
  position = 'bottom-right' 
}) => {
  const navigate = useNavigate();

  const positionClasses = {
    'top-left': 'top-6 left-6',
    'top-right': 'top-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-6 right-6'
  };

  const handleClick = () => {
    navigate(exercise.route);
    onClose();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: position.includes('right') ? 100 : -100, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: position.includes('right') ? 100 : -100 }}
          className={`fixed ${positionClasses[position]} z-50 w-96 max-w-[90vw]`}
        >
          <div className="bg-white rounded-ui-xl shadow-elevated border-2 border-purple-200 overflow-hidden">
            {/* Header con gradiente */}
            <div className={`bg-gradient-to-r ${
              exercise.type === 'anxiety' 
                ? 'from-blue-500 to-blue-600' 
                : 'from-amber-500 to-amber-600'
            } p-4 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{exercise.icon}</span>
                <div className="text-white">
                  <p className="font-bold text-sm">Recomendación para ti</p>
                  <p className="text-xs opacity-90">Basado en tu evaluación</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition"
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5">
              <h4 className="font-bold text-gray-800 text-lg mb-2">
                {exercise.title}
              </h4>
              <p className="text-gray-700 text-sm mb-4 leading-relaxed">
                {exercise.description}
              </p>

              {/* Información adicional */}
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1">
                  <span>⏱️</span>
                  {exercise.duration}
                </span>
                {exercise.tags && exercise.tags.slice(0, 2).map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3">
                <button
                  onClick={handleClick}
                  className={`flex-1 px-4 py-3 bg-gradient-to-r ${
                    exercise.type === 'anxiety'
                      ? 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                      : 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                  } text-white rounded-ui-sm font-semibold transition flex items-center justify-center gap-2`}
                >
                  <span>Comenzar ahora</span>
                  <span>→</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-ui-sm font-semibold transition"
                >
                  Después
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Modal de Recomendación - Aparece en el centro
 */
export const RecommendationModal = ({ 
  exercises, 
  isOpen, 
  onClose,
  personalizedMessage 
}) => {
  const navigate = useNavigate();

  const handleExerciseClick = (exercise) => {
    navigate(exercise.route);
    onClose();
  };

  return (
    <UnifiedModal
      isOpen={isOpen}
      variant="info"
      title={personalizedMessage?.title || "Recomendaciones"}
      icon={personalizedMessage?.emoji || "💡"}
      onClose={onClose}
      size="lg"
      primaryAction={{ label: "Ver más tarde", onClick: onClose }}
    >
      {personalizedMessage?.message ? (
        <p className="text-sm text-gray-700 mb-5">{personalizedMessage.message}</p>
      ) : null}

      <h3 className="text-lg font-bold text-gray-900 mb-4">
        Ejercicios recomendados para ti:
      </h3>

      <div className="space-y-4">
        {(exercises || []).map((exercise, index) => (
          <motion.div
            key={exercise.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`group border-2 ${
              exercise.type === 'anxiety'
                ? 'border-blue-200 hover:border-blue-400 bg-blue-50/50'
                : 'border-amber-200 hover:border-amber-400 bg-amber-50/50'
            } rounded-ui-xl p-5 transition-all shadow-card hover:shadow-elevated cursor-pointer`}
            onClick={() => handleExerciseClick(exercise)}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-16 h-16 bg-gradient-to-br ${
                  exercise.type === 'anxiety'
                    ? 'from-blue-400 to-blue-600'
                    : 'from-amber-400 to-amber-600'
                } rounded-ui-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
              >
                <span className="text-3xl">{exercise.icon}</span>
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-gray-800 text-lg">
                    {exercise.title}
                  </h4>
                  <span className="text-xs bg-white px-3 py-1 rounded-full text-gray-600 flex items-center gap-1 flex-shrink-0 ml-2">
                    <span>⏱️</span>
                    {exercise.duration}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                  {exercise.description}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {exercise.tags && exercise.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-1 ${
                        exercise.type === 'anxiety'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      } rounded-full text-xs`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className={`${
                  exercise.type === 'anxiety' ? 'text-blue-500' : 'text-amber-500'
                } text-2xl group-hover:translate-x-1 transition-transform flex-shrink-0`}
              >
                →
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </UnifiedModal>
  );
};

/**
 * Badge flotante - Indicador discreto
 */
export const FloatingBadge = ({ 
  count, 
  onClick, 
  position = 'top-right' 
}) => {
  const positionClasses = {
    'top-left': 'top-6 left-6',
    'top-right': 'top-20 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-20 right-6'
  };

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`fixed ${positionClasses[position]} z-40 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full shadow-elevated hover:shadow-modal transition-all`}
    >
      <div className="relative px-5 py-3 flex items-center gap-2">
        <span className="text-2xl">💡</span>
        <div className="text-left">
          <p className="text-xs font-semibold opacity-90">Tienes</p>
          <p className="text-lg font-bold leading-none">{count} {count === 1 ? 'recomendación' : 'recomendaciones'}</p>
        </div>
        {count > 0 && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white"
          >
            {count}
          </motion.div>
        )}
      </div>
    </motion.button>
  );
};

/**
 * Mini Toast - Notificación pequeña y discreta
 */
export const MiniToast = ({ 
  message, 
  isVisible, 
  onClose, 
  onClick,
  autoHideDuration = 10000 
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full shadow-elevated flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
            onClick={onClick}
          >
            <span className="text-2xl">💡</span>
            <p className="font-semibold">{message}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="ml-2 w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};