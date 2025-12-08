import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

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

        navigate('/admin/dashboard');
      } else {
        setError('Error en la autenticación');
      }

    } catch (err) {
      console.error('Error en login admin:', err);
      if (err.response?.status === 401) {
        setError('Usuario o contraseña incorrectos');
      } else if (err.response?.status === 403) {
        setError('Acceso denegado. No tienes permisos de administrador');
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        {/* Card de login */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-blue-600">
          
          {/* Header con icono */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-4xl shadow-lg">
              🛡️
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">
              Panel Administrativo
            </h1>
            <p className="text-sm text-gray-500">
              Espejo Inteligente - Sistema de Monitoreo
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email / Usuario
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="admin@espejo.com"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Recordar sesión */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="remember" className="text-sm text-gray-700">
                Recordar sesión
              </label>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Botón de login */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 transition-all ${
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
              }`}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            {/* Link olvidaste contraseña */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Credenciales de prueba */}
            <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Credenciales de prueba: admin / admin123
              </p>
            </div>

          </form>

          {/* Botón volver */}
          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium transition"
            >
              ← Volver al inicio
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

export default AdminLogin;