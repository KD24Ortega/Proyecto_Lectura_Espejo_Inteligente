import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ProfileSuccess() {

  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState("");

  // Cargar datos guardados desde Register
  useEffect(() => {

    setName(localStorage.getItem("user_name") || "Usuario");
    setAge(localStorage.getItem("user_age") || "");
    setPhoto(localStorage.getItem("user_photo") || "");

  }, []);

  return (

    <div className="min-h-screen bg-[#f4f7fc] flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 text-center">

        {/* --- TITULO --- */}
        <h1 className="text-3xl font-bold text-gray-900">
          ¡Perfil creado!
        </h1>

        <p className="text-gray-500 text-lg mt-2">
          Tu asistente de bienestar está listo
        </p>

        {/* --- TARJETA PERFIL --- */}
        <div className="mt-8 border-2 border-blue-500 rounded-2xl p-6 flex flex-col items-center">

          {/* FOTO */}
          <div className="w-28 h-28 rounded-full border-4 border-blue-500 overflow-hidden mb-3 bg-gray-200">

            {photo && (
              <img
                src={photo}
                alt="Perfil"
                className="w-full h-full object-cover"
              />
            )}

          </div>

          {/* DATOS */}
          <h2 className="text-2xl font-semibold text-gray-800">
            {name}
          </h2>

          {age && (
            <p className="text-gray-500">
              {age} años
            </p>
          )}

          {/* BADGE */}
          <div className="mt-4 px-4 py-2 rounded-full bg-blue-100 text-blue-600 flex items-center font-semibold">
            ✨ Perfil personalizado listo
          </div>

        </div>

        {/* --- PREGUNTA --- */}
        <h3 className="mt-8 text-xl text-gray-700">
          ¿Quieres comenzar tu primera evaluación?
        </h3>

        {/* --- BOTONES --- */}
        <div className="mt-6 flex gap-4 justify-center">

          <button
            onClick={() => navigate("/home")}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition"
          >
            Más tarde
          </button>

          <button
            onClick={() => navigate("/evaluation")}
            className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition"
          >
            ✨ Empezar ahora
          </button>

        </div>

        {/* --- VOLVER --- */}
        <button
          onClick={() => navigate("/register")}
          className="mt-6 text-gray-400 hover:text-gray-600 transition"
        >
          ← Volver a editar
        </button>

      </div>

    </div>

  );
}
