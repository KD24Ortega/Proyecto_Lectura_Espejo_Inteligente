import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Camera from '../components/Camera';
import api from '../services/api';

function Login() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Iniciando cámara...');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [userName, setUserName] = useState('');
  const [confidence, setConfidence] = useState(0);

  // Función para reconocer rostro
  const handleCapture = async (frameBase64) => {
    if (isRecognizing) return; // Evitar múltiples peticiones simultáneas
    
    setIsRecognizing(true);
    setStatus('🔍 Reconociendo rostro...');

    try {
      // Convertir base64 a blob
      const base64Data = frameBase64.split(',')[1];
      const binaryData = atob(base64Data);
      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'image/jpeg' });

      // Crear FormData
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      // Llamar al endpoint de reconocimiento
      const response = await api.post('/face/recognize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { found, user, confidence: conf } = response.data;

      if (found && user) {
        setUserName(user);
        setConfidence(Math.round(conf * 100));
        setStatus(`✅ ¡Bienvenido, ${user}!`);

        // Iniciar sesión automáticamente
        setTimeout(async () => {
          try {
            const sessionResponse = await api.post('/session/start', {
              username: user
            });
            
            // Guardar token si tu backend lo devuelve
            if (sessionResponse.data.access_token) {
              localStorage.setItem('token', sessionResponse.data.access_token);
              localStorage.setItem('user', user);
            }

            // Redirigir al dashboard
            navigate('/dashboard');
          } catch (err) {
            console.error('Error al iniciar sesión:', err);
            setStatus('❌ Error al iniciar sesión');
          }
        }, 1500);
      } else if (found && !user) {
        setStatus('👤 Rostro detectado, pero no reconocido');
        setConfidence(Math.round(conf * 100));
      } else {
        setStatus('⚠️ No se detectó ningún rostro');
      }
    } catch (error) {
      console.error('Error en reconocimiento:', error);
      setStatus('❌ Error al reconocer rostro');
    } finally {
      setIsRecognizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
        
        {/* Columna izquierda: Cámara */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            🎥 Reconocimiento Facial
          </h2>
          
          <Camera onCapture={handleCapture} isActive={true} />
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Colócate frente a la cámara
            </p>
          </div>
        </div>

        {/* Columna derecha: Estado */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Espejo Inteligente
            </h1>
            <p className="text-gray-600">
              Sistema de Monitoreo de Salud Mental
            </p>
          </div>

          {/* Estado del reconocimiento */}
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-6 mb-6">
            <p className="text-lg font-semibold text-gray-800 mb-2">
              Estado:
            </p>
            <p className="text-2xl font-bold text-purple-600">
              {status}
            </p>
          </div>

          {/* Información del usuario */}
          {userName && (
            <div className="bg-green-100 rounded-xl p-6 mb-6">
              <p className="text-sm text-gray-600 mb-1">Usuario detectado:</p>
              <p className="text-3xl font-bold text-green-700">{userName}</p>
              <p className="text-sm text-gray-600 mt-2">
                Confianza: {confidence}%
              </p>
            </div>
          )}

          {/* Botón de registro manual */}
          <div className="mt-auto">
            <button
              onClick={() => navigate('/register')}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-blue-600 transition duration-300 shadow-lg"
            >
              📝 Registrar nuevo usuario
            </button>
          </div>

          {/* Opción para admin */}
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/admin/login')}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Acceso Administrador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;