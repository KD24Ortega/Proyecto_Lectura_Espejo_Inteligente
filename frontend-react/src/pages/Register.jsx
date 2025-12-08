import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Camera from '../components/Camera';
import api from '../services/api';

function Register() {

  const navigate = useNavigate();
  const capturedFrameRef = useRef(null);

  // Pasos:
  // 1 = Intro
  // 2 = Datos personales
  // 3 = Captura de rostro
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: '',
    email: ''
  });

  const [status, setStatus] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  // -------------------------
  // INPUTS
  // -------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // -------------------------
  // CAPTURA
  // -------------------------
  const handleCaptureFrame = (frameBase64) => {
    capturedFrameRef.current = frameBase64;
    setStatus("✅ Rostro capturado correctamente");
  };

  // -------------------------
  // REGISTRO
  // -------------------------
  const handleRegister = async () => {

    if (!capturedFrameRef.current) {
      setStatus("⚠️ Primero captura tu rostro");
      return;
    }

    setIsCapturing(true);
    setStatus("📤 Enviando datos...");

    try {

      const base64Data = capturedFrameRef.current.split(',')[1];
      const binaryData = atob(base64Data);
      const array = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++)
        array[i] = binaryData.charCodeAt(i);

      const blob = new Blob([array], { type: "image/jpeg" });

      const fd = new FormData();
      fd.append("full_name", formData.full_name.trim());
      fd.append("file", blob, "face.jpg");

      if (formData.age) fd.append("age", formData.age);
      if (formData.gender) fd.append("gender", formData.gender);
      if (formData.email) fd.append("email", formData.email);

      const response = await api.post("/face/register", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (response.data.success) {

        localStorage.setItem("user_name", response.data.full_name);
        localStorage.setItem("user_age", formData.age || "");
        localStorage.setItem("user_photo", capturedFrameRef.current);

        navigate("/profile-success");

      } else {
        setStatus(`❌ ${response.data.message || "Registro fallido"}`);
      }

    } catch (err) {

      const serverError = err.response?.data?.detail || err.message;
      console.error(err);
      setStatus(`❌ ${serverError}`);

    } finally {
      setIsCapturing(false);
    }
  };

  // -------------------------
  // VALIDACIÓN PRIMARIA
  // -------------------------
  const handleGoToData = () => {
    if (!formData.full_name.trim()) {
      alert("Debes ingresar tu nombre completo");
      return;
    }
    setStep(3);
  };

  return (

    <div className="min-h-screen bg-[#f4f7fc] flex items-center justify-center p-4">

      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6">

        {/* --------------------- */}
        {/* PASO 1 - INTRO */}
        {/* --------------------- */}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">
              ¡Creemos tu perfil!
            </h1>

            <div className="border-2 border-blue-500 rounded-2xl p-4 flex justify-around mb-6">
              <div className="text-center">
                ❤️
                <p className="text-xs mt-2">Salud</p>
              </div>
              <div className="text-center">
                🛡️
                <p className="text-xs mt-2">Seguridad</p>
              </div>
              <div className="text-center">
                ✨
                <p className="text-xs mt-2">Bienestar</p>
              </div>
            </div>

            <p className="text-center text-gray-600 mb-8">
              Solo necesitamos algunos datos para personalizar tu experiencia.
            </p>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-500 text-white py-3 rounded-full font-semibold hover:bg-blue-600 transition"
            >
              Comenzar →
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
              className="text-blue-500 mb-4"
            >
              ← Atrás
            </button>

            <h2 className="text-xl font-semibold mb-4">
              Datos personales
            </h2>

            <p className="text-gray-600 mb-4">
              Ayúdanos a personalizar tu experiencia
            </p>

            <div className="border-2 border-blue-400 rounded-2xl p-4 space-y-4">

              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                className="w-full bg-gray-100 p-3 rounded-lg"
                placeholder="Nombre completo"
              />

              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                className="w-full bg-gray-100 p-3 rounded-lg"
                placeholder="Edad"
              />

              <div className="flex flex-wrap gap-2">

                {[
                  {v:'m', t:'Masculino'},
                  {v:'f', t:'Femenino'},
                  {v:'otro', t:'Otro'},
                  {v:'no', t:'Prefiero no decir'}
                ].map(opt => (
                  <button
                    key={opt.v}
                    className={`px-4 py-2 rounded-full border
                      ${formData.gender===opt.v
                        ? 'bg-blue-500 text-white'
                        : 'bg-white'}
                    `}
                    onClick={() =>
                      setFormData(p=>({...p, gender: opt.v}))}
                  >
                    {opt.t}
                  </button>
                ))}

              </div>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full bg-gray-100 p-3 rounded-lg"
                placeholder="Email"
              />

            </div>

            <button
              onClick={handleGoToData}
              className="mt-6 w-full bg-blue-500 text-white py-3 rounded-full font-semibold hover:bg-blue-600 transition"
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
              className="text-blue-500 mb-4"
            >
              ← Atrás
            </button>

            <h2 className="text-xl font-semibold text-center mb-4">
              Captura tu rostro
            </h2>

            <div className="border-2 border-blue-400 rounded-2xl overflow-hidden relative mb-5">

              {/* Cámara */}
              <Camera onCapture={handleCaptureFrame} isActive={true} />

              {/* Óvalo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-dashed w-[65%] h-[75%] rounded-full"></div>
              </div>

            </div>

            <div className="text-sm text-gray-600 text-center mb-4">
              📸 Coloca tu rostro dentro del óvalo  
              <br/>y mantén expresión neutral
            </div>

            {status && (
              <p className="text-center font-semibold mb-3">
                {status}
              </p>
            )}

            <button
              onClick={handleRegister}
              disabled={isCapturing}
              className={`w-full py-3 rounded-full font-semibold
                ${isCapturing
                  ? 'bg-gray-400'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'}
              `}
            >
              {isCapturing ? 'Registrando...' : '📸 Capturar foto'}
            </button>
          </>
        )}

      </div>

    </div>
  );
}

export default Register;
