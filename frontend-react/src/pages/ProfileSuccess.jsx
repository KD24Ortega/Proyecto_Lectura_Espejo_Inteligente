import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function ProfileSuccess() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Cargar datos guardados desde Register
  useEffect(() => {
    const userName = localStorage.getItem("user_name");
    const userAge = localStorage.getItem("user_age");
    const userBirthDate = localStorage.getItem("user_birth_date");
    const userEmail = localStorage.getItem("user_email");
    const userPhoto = localStorage.getItem("user_photo");

    // Validar que existan datos
    if (!userName) {
      console.warn("⚠️ No hay datos de usuario, redirigiendo a registro");
      navigate("/register");
      return;
    }

    setName(userName);
    if (userAge) {
      setAge(userAge);
    } else if (userBirthDate) {
      const d = new Date(userBirthDate);
      if (!Number.isNaN(d.getTime())) {
        const today = new Date();
        let computed = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
          computed -= 1;
        }
        if (computed >= 0) setAge(String(computed));
      }
    }
    setEmail(userEmail || "");
    setPhoto(userPhoto || "");

    // Mostrar confetti
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, [navigate]);

  const handleStartNow = () => {
    console.log("🚀 Iniciando primera evaluación PHQ-9");
    navigate("/phq9");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Confetti animado */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{
                x: Math.random() * window.innerWidth,
                y: -20,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: window.innerHeight + 20,
                rotate: 360,
                opacity: 0,
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                ease: "linear",
                delay: Math.random() * 0.5,
              }}
            >
              {["🎉", "✨", "🎊", "⭐", "💫"][Math.floor(Math.random() * 5)]}
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 text-center"
      >
        {/* Icono de éxito animado */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg"
        >
          <span className="text-5xl text-white">✓</span>
        </motion.div>

        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-3"
        >
          ¡Perfil creado exitosamente!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 text-lg mb-8"
        >
          Tu asistente de bienestar está listo para cuidarte
        </motion.p>

        {/* Tarjeta de perfil */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 mb-8 border-2 border-blue-200"
        >
          {/* Foto de perfil */}
          <div className="relative w-32 h-32 mx-auto mb-4">
            <div className="w-full h-full rounded-full border-4 border-blue-500 overflow-hidden bg-gradient-to-br from-blue-200 to-purple-200 shadow-xl">
              {photo ? (
                <img src={photo} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl text-blue-600">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Badge verificado */}
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
              <span className="text-2xl">✓</span>
            </div>
          </div>

          {/* Datos del usuario */}
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{name}</h2>

          <div className="flex flex-col gap-2 text-gray-600">
            {age && (
              <p className="flex items-center justify-center gap-2">
                <span>🎂</span>
                <span>{age} años</span>
              </p>
            )}
            {email && (
              <p className="flex items-center justify-center gap-2">
                <span>📧</span>
                <span className="text-sm">{email}</span>
              </p>
            )}
          </div>

          {/* Badge de estado */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold shadow-md">
            <span>✨</span>
            <span>Perfil verificado</span>
          </div>
        </motion.div>

        {/* Pregunta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            ¿Quieres comenzar tu primera evaluación?
          </h3>
          <p className="text-gray-600 text-sm">
            Te tomará solo 5 minutos y nos ayudará a entender cómo te sientes
          </p>
        </motion.div>

        {/* ✅ Solo un botón */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex"
        >
          <button
            onClick={handleStartNow}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <span className="flex items-center justify-center gap-2">
              <span>🚀</span>
              <span>Empezar ahora</span>
            </span>
          </button>
        </motion.div>

        {/* Info adicional */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <p className="text-sm text-gray-700">
            💡 <strong>¿Por qué es importante?</strong>
            <br />
            Las evaluaciones nos ayudan a monitorear tu bienestar emocional y ofrecerte el mejor apoyo personalizado.
          </p>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 text-gray-500 text-sm"
        >
          Estamos aquí para apoyarte en cada paso 💙
        </motion.p>
      </motion.div>
    </div>
  );
}
