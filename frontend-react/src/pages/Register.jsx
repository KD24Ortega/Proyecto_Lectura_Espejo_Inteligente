import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Camera from '../components/Camera';
import api from '../services/api';

// Modal personalizado para alertas
const AlertModal = ({ message, type = 'error', onClose }) => {
  const icons = {
    error: '❌',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️'
  };

  const colors = {
    error: 'border-red-300 bg-red-50',
    warning: 'border-yellow-300 bg-yellow-50',
    success: 'border-green-300 bg-green-50',
    info: 'border-blue-300 bg-blue-50'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-2 ${colors[type]}`}>
        <div className="text-center">
          <div className="text-5xl mb-4">{icons[type]}</div>
          <p className="text-gray-800 font-medium mb-6">{message}</p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:from-blue-600 hover:to-blue-700 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

function Register() {
  const navigate = useNavigate();
  const capturedFrameRef = useRef(null);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: '',
    email: ''
  });

  const [status, setStatus] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [alert, setAlert] = useState(null); // { message, type }
  const [errors, setErrors] = useState({});

  // -------------------------
  // VALIDACIONES
  // -------------------------
  const validateName = (name) => {
    // Solo letras y espacios
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!name.trim()) {
      return 'El nombre es obligatorio';
    }
    if (!nameRegex.test(name)) {
      return 'El nombre solo puede contener letras';
    }
    if (name.trim().length < 3) {
      return 'El nombre debe tener al menos 3 caracteres';
    }
    return null;
  };

  const validateAge = (age) => {
    const ageNum = parseInt(age);
    if (!age) {
      return 'La edad es obligatoria';
    }
    if (isNaN(ageNum)) {
      return 'La edad debe ser un número';
    }
    if (ageNum < 13 || ageNum > 120) {
      return 'La edad debe estar entre 13 y 120 años';
    }
    return null;
  };

  const validateEmail = (email) => {
    // Regex para email válido
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      return 'El email es obligatorio';
    }
    if (!emailRegex.test(email)) {
      return 'El email no tiene un formato válido (ejemplo: usuario@dominio.com)';
    }
    return null;
  };

  const validateGender = (gender) => {
    if (!gender) {
      return 'Debes seleccionar tu género';
    }
    return null;
  };

  // -------------------------
  // FORMATEO DE NOMBRE
  // -------------------------
  const formatName = (name) => {
    // Capitalizar primera letra de cada palabra
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // -------------------------
  // INPUTS CON VALIDACIÓN
  // -------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Validaciones en tiempo real
    if (name === 'full_name') {
      // Solo permitir letras y espacios
      processedValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
      // Capitalizar mientras escribe
      if (processedValue) {
        processedValue = formatName(processedValue);
      }
    }

    if (name === 'age') {
      // Solo permitir números
      processedValue = value.replace(/[^0-9]/g, '');
      // Limitar a 3 dígitos
      if (processedValue.length > 3) {
        processedValue = processedValue.slice(0, 3);
      }
    }

    if (name === 'email') {
      // Convertir a minúsculas
      processedValue = value.toLowerCase().trim();
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));

    // Limpiar error de ese campo
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleGenderSelect = (gender) => {
    setFormData(prev => ({ ...prev, gender }));
    if (errors.gender) {
      setErrors(prev => ({ ...prev, gender: null }));
    }
  };

  // -------------------------
  // CAPTURA DE ROSTRO
  // -------------------------
  const handleCaptureFrame = (frameBase64) => {
    capturedFrameRef.current = frameBase64;
    setStatus("✅ Rostro capturado correctamente");
  };

  // -------------------------
  // VALIDAR FORMULARIO
  // -------------------------
  const validateForm = () => {
    const newErrors = {};

    const nameError = validateName(formData.full_name);
    if (nameError) newErrors.full_name = nameError;

    const ageError = validateAge(formData.age);
    if (ageError) newErrors.age = ageError;

    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;

    const genderError = validateGender(formData.gender);
    if (genderError) newErrors.gender = genderError;

    setErrors(newErrors);

    // Si hay errores, mostrar el primero en modal
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      setAlert({ message: firstError, type: 'error' });
      return false;
    }

    return true;
  };

  // -------------------------
  // AVANZAR A CAPTURA
  // -------------------------
  const handleGoToCapture = () => {
    if (validateForm()) {
      setStep(3);
    }
  };

  // -------------------------
  // REGISTRO FINAL
  // -------------------------
  const handleRegister = async () => {
    if (!capturedFrameRef.current) {
      setAlert({ message: 'Primero debes capturar tu rostro', type: 'warning' });
      return;
    }

    setIsCapturing(true);
    setStatus("📤 Enviando datos...");

    try {
      const base64Data = capturedFrameRef.current.split(',')[1];
      const binaryData = atob(base64Data);
      const array = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([array], { type: "image/jpeg" });

      const fd = new FormData();
      fd.append("full_name", formData.full_name.trim());
      fd.append("age", formData.age);
      fd.append("gender", formData.gender);
      fd.append("email", formData.email.toLowerCase().trim());
      fd.append("file", blob, "face.jpg");

      console.log('📤 Enviando registro:', {
        full_name: formData.full_name.trim(),
        age: formData.age,
        gender: formData.gender,
        email: formData.email
      });

      const response = await api.post("/face/register", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (response.data.success) {
        console.log('✅ Registro exitoso:', response.data);

        // Guardar datos en localStorage
        localStorage.setItem("user_name", response.data.full_name);
        localStorage.setItem("user_age", formData.age);
        localStorage.setItem("user_email", formData.email);
        localStorage.setItem("user_photo", capturedFrameRef.current);

        // Obtener user_id si viene en la respuesta
        if (response.data.user_id) {
          localStorage.setItem("user_id", response.data.user_id.toString());
        }

        setStatus("✅ ¡Registro exitoso!");

        // Redirigir a profile-success después de 1 segundo
        setTimeout(() => {
          navigate("/profile-success");
        }, 1000);

      } else {
        setAlert({ 
          message: response.data.message || "Error al registrar usuario", 
          type: 'error' 
        });
        setStatus("");
      }

    } catch (err) {
      console.error('❌ Error en registro:', err);
      
      const serverError = err.response?.data?.detail || err.message || "Error de conexión con el servidor";
      
      setAlert({ 
        message: `Error: ${serverError}`, 
        type: 'error' 
      });
      setStatus("");

    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">

      {/* Modal de alertas */}
      {alert && (
        <AlertModal
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">

        {/* --------------------- */}
        {/* PASO 1 - INTRO */}
        {/* --------------------- */}
        {step === 1 && (
          <>
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl shadow-lg">
                ✨
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                ¡Creemos tu perfil!
              </h1>
              <p className="text-gray-600">
                Tu bienestar es nuestra prioridad
              </p>
            </div>

            <div className="border-2 border-blue-500 rounded-2xl p-6 flex justify-around mb-6 bg-blue-50">
              <div className="text-center">
                <div className="text-4xl mb-2">❤️</div>
                <p className="text-xs font-medium text-gray-700">Salud</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🛡️</div>
                <p className="text-xs font-medium text-gray-700">Seguridad</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">✨</div>
                <p className="text-xs font-medium text-gray-700">Bienestar</p>
              </div>
            </div>

            <p className="text-center text-gray-600 mb-8">
              Solo necesitamos algunos datos para personalizar tu experiencia y cuidar de tu salud emocional.
            </p>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Comenzar →
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full mt-3 text-gray-600 hover:text-gray-800 py-2 font-medium"
            >
              ← Volver al inicio
            </button>
          </>
        )}

        {/* --------------------- */}
        {/* PASO 2 - FORMULARIO */}
        {/* --------------------- */}
        {step === 2 && (
          <>
            <button
              onClick={() => setStep(1)}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium"
            >
              ← Atrás
            </button>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Datos personales
            </h2>
            <p className="text-gray-600 mb-6">
              Completa todos los campos para continuar
            </p>

            <div className="space-y-4">

              {/* Nombre completo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className={`w-full bg-gray-50 p-3 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.full_name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Ej: Juan Pérez"
                  maxLength={50}
                />
                {errors.full_name && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.full_name}
                  </p>
                )}
              </div>

              {/* Edad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Edad *
                </label>
                <input
                  type="text"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className={`w-full bg-gray-50 p-3 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.age ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Ej: 25"
                  maxLength={3}
                />
                {errors.age && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.age}
                  </p>
                )}
              </div>

              {/* Género */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Género *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'm', t: 'Masculino', icon: '👨' },
                    { v: 'f', t: 'Femenino', icon: '👩' },
                    { v: 'otro', t: 'Otro', icon: '🧑' },
                    { v: 'no', t: 'Prefiero no decir', icon: '🤐' }
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      className={`px-4 py-3 rounded-lg border-2 font-medium transition ${
                        formData.gender === opt.v
                          ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => handleGenderSelect(opt.v)}
                    >
                      <span className="mr-2">{opt.icon}</span>
                      {opt.t}
                    </button>
                  ))}
                </div>
                {errors.gender && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.gender}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full bg-gray-50 p-3 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Ej: juan@ejemplo.com"
                  maxLength={100}
                />
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.email}
                  </p>
                )}
              </div>

            </div>

            <button
              onClick={handleGoToCapture}
              className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Continuar →
            </button>
          </>
        )}

        {/* --------------------- */}
        {/* PASO 3 - CAPTURA */}
        {/* --------------------- */}
        {step === 3 && (
          <>
            <button
              onClick={() => setStep(2)}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium"
            >
              ← Atrás
            </button>

            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
              Captura tu rostro
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Centra tu rostro en el óvalo
            </p>

            <div className="border-4 border-blue-500 rounded-2xl overflow-hidden relative mb-5 bg-gray-100">

              {/* Cámara */}
              <Camera onCapture={handleCaptureFrame} isActive={true} />

              {/* Óvalo guía */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-dashed border-white w-[70%] h-[80%] rounded-full shadow-lg"></div>
              </div>

            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 text-center">
                📸 <strong>Consejos:</strong>
                <br />• Coloca tu rostro dentro del óvalo
                <br />• Mantén una expresión neutral
                <br />• Asegúrate de tener buena iluminación
              </p>
            </div>

            {status && (
              <div className={`text-center font-semibold mb-4 p-3 rounded-lg ${
                status.includes('✅') ? 'bg-green-50 text-green-700' : 
                status.includes('📤') ? 'bg-blue-50 text-blue-700' :
                'bg-gray-50 text-gray-700'
              }`}>
                {status}
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={isCapturing}
              className={`w-full py-4 rounded-full font-semibold transition shadow-lg ${
                isCapturing
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transform hover:scale-105'
              }`}
            >
              {isCapturing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Registrando...
                </span>
              ) : (
                '📸 Capturar y registrar'
              )}
            </button>
          </>
        )}

      </div>

    </div>
  );
}

export default Register;