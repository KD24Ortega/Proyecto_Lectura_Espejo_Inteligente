import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import useDynamicTheme from '../hooks/useDynamicTheme';

function AdminLogin() {
  const { theme } = useDynamicTheme();
  const bg = theme?.colors?.primary || 'from-gray-400 via-gray-500 to-slate-600';

  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    type: 'error',
    title: '',
    message: ''
  });

  // ============================================
  // COMPONENTE MODAL
  // ============================================
  const Modal = ({ type, title, message, onClose }) => {
    const icons = {
      error: '❌',
      warning: '⚠️',
      info: '💡',
      success: '✅'
    };

    const colorClasses = {
      error: {
        bg: 'from-red-50 to-red-100',
        title: 'text-red-600',
        button: 'bg-red-600 hover:bg-red-700'
      },
      warning: {
        bg: 'from-yellow-50 to-yellow-100',
        title: 'text-yellow-600',
        button: 'bg-yellow-600 hover:bg-yellow-700'
      },
      info: {
        bg: 'from-blue-50 to-blue-100',
        title: 'text-blue-600',
        button: 'bg-blue-600 hover:bg-blue-700'
      },
      success: {
        bg: 'from-green-50 to-green-100',
        title: 'text-green-600',
        button: 'bg-green-600 hover:bg-green-700'
      }
    };

    const colors = colorClasses[type];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
        >
          <div className="text-center">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="mb-4 text-6xl"
            >
              {icons[type]}
            </motion.div>
            {title && (
              <h3 className={`text-2xl font-bold ${colors.title} mb-3`}>
                {title}
              </h3>
            )}
            <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>
            
            <button
              onClick={onClose}
              className={`px-8 py-3 ${colors.button} text-white rounded-xl font-semibold transition-all shadow-lg hover:scale-105`}
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const showModalMessage = (config) => {
    setModalConfig(config);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  // ============================================
  // MANEJO DEL FORMULARIO
  // ============================================
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.username.trim()) {
      showModalMessage({
        type: 'warning',
        title: 'Campo requerido',
        message: 'Por favor, ingresa tu usuario o email.'
      });
      return;
    }

    if (!formData.password.trim()) {
      showModalMessage({
        type: 'warning',
        title: 'Campo requerido',
        message: 'Por favor, ingresa tu contraseña.'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/admin/login', {
        username: formData.username,
        password: formData.password
      });

      if (response.data.success) {
        const storage = rememberMe ? localStorage : sessionStorage;
        
        storage.setItem('admin_token', response.data.access_token);
        storage.setItem('admin_id', response.data.user.id);
        storage.setItem('admin_username', response.data.user.username);
        storage.setItem('admin_name', response.data.user.full_name);

        console.log('✅ Login exitoso:', response.data.user);

        // Modal de éxito antes de redirigir
        showModalMessage({
          type: 'success',
          title: '¡Bienvenido!',
          message: `Acceso concedido. Redirigiendo al panel administrativo...`
        });

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1500);
      } else {
        showModalMessage({
          type: 'error',
          title: 'Error de autenticación',
          message: 'No se pudo verificar tus credenciales. Por favor, intenta nuevamente.'
        });
      }

    } catch (err) {
      console.error('Error en login admin:', err);
      
      if (err.response?.status === 401) {
        showModalMessage({
          type: 'error',
          title: 'Credenciales incorrectas',
          message: 'El usuario o contraseña ingresados no son válidos. Por favor, verifica e intenta nuevamente.'
        });
      } else if (err.response?.status === 403) {
        showModalMessage({
          type: 'error',
          title: 'Acceso denegado',
          message: 'No tienes permisos de administrador. Si crees que esto es un error, contacta al administrador del sistema.'
        });
      } else if (err.code === 'ERR_NETWORK') {
        showModalMessage({
          type: 'error',
          title: 'Error de conexión',
          message: 'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.'
        });
      } else {
        showModalMessage({
          type: 'error',
          title: 'Error inesperado',
          message: 'Ocurrió un error al iniciar sesión. Por favor, intenta nuevamente en unos momentos.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} transition-all duration-1000 flex items-center justify-center p-6`}>
      
      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal
            {...modalConfig}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        
        {/* Card de login */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-blue-600">
          
          {/* Header con icono */}
          <div className="flex justify-center mb-6">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 0.8 }}
              className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-5xl shadow-lg"
            >
              🛡️
            </motion.div>
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Panel Administrativo
            </h1>
            <p className="text-sm text-gray-500">
              CalmaSense - Sistema de Monitoreo
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Usuario
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Ingresa tu usuario"
                autoComplete="username"
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Recordar sesión */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer select-none">
                Mantener sesión iniciada
              </label>
            </div>

            {/* Botón de login */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg transition-all ${
                isLoading 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:scale-[1.02] hover:shadow-xl hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <motion.div
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span>Verificando...</span>
                </div>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </button>

            {/* Credenciales de prueba */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">💡 Credenciales de desarrollo:</p>
                <p className="text-sm font-mono text-blue-700">
                  <span className="font-semibold">Usuario:</span> admin
                </p>
                <p className="text-sm font-mono text-blue-700">
                  <span className="font-semibold">Contraseña:</span> admin123
                </p>
              </div>
            </div>

          </form>

          {/* Botón volver */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 text-gray-600 hover:text-gray-800 font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <span>←</span>
              <span>Volver al inicio</span>
            </button>
          </div>

        </div>

        {/* Información adicional */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <p className="text-sm text-gray-600">
            🔒 Acceso seguro y encriptado
          </p>
        </motion.div>

      </motion.div>
    </div>
  );
}

export default AdminLogin;