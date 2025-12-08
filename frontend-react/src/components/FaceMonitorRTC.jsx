import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// Generar un ID simple por sesión (podrías usar el user_id real si quieres)
const createClientId = () => {
  return "client-" + Math.random().toString(36).substring(2, 10);
};

function FaceMonitorRTC({ isActive = true }) {

  const navigate = useNavigate();
  const pcRef = useRef(null);
  const pollRef = useRef(null);
  const clientIdRef = useRef(createClientId());
  const lastDetectionTimeRef = useRef(Date.now());

  const SESSION_TIMEOUT = 10000; // 10s
  const POLL_INTERVAL = 2000;    // 2s

  useEffect(() => {
    if (!isActive) return;

    startWebRTC();

    return () => stopWebRTC();
  }, [isActive]);

  const startWebRTC = async () => {
    try {
      // 1. Obtener cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      // 2. Crear RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }
        ]
      });

      pcRef.current = pc;

      // 3. Añadir track de vídeo
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 4. Crear offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Enviar offer al backend
      const client_id = clientIdRef.current;

      const res = await api.post("/webrtc/offer", {
        client_id,
        sdp: offer.sdp,
        type: offer.type
      });

      const answer = res.data;

      // 6. Setear answer remota
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      console.log("📡 WebRTC conectado con client_id =", client_id);

      // 7. Iniciar polling de presencia
      startPollingPresence();

    } catch (err) {
      console.error("❌ Error iniciando WebRTC:", err);
    }
  };

  const stopWebRTC = () => {
    console.log("🛑 Deteniendo WebRTC");

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.getSenders().forEach(sender => {
        if (sender.track) sender.track.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const startPollingPresence = () => {
    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      try {

        const client_id = clientIdRef.current;

        const res = await api.get(`/presence/${client_id}`);
        const data = res.data;

        console.log("📊 presence:", data);

        if (data.found && data.confidence >= 0.45) {
          // Usuario presente
          lastDetectionTimeRef.current = Date.now();
          console.log(
            `✅ Presente (user=${data.user}, conf=${data.confidence.toFixed(2)})`
          );
          return;
        }

        // No detectado → verificar timeout
        const elapsed = Date.now() - lastDetectionTimeRef.current;

        if (elapsed >= SESSION_TIMEOUT) {
          console.log("⏱️ Timeout por ausencia - cerrando sesión");
          handleLogout();
        } else {
          const remaining = Math.ceil((SESSION_TIMEOUT - elapsed) / 1000);
          console.log(`⚠️ No detectado (${remaining}s restantes)`);
        }

      } catch (err) {
        console.error("Error al consultar presencia:", err);
      }
    }, POLL_INTERVAL);

    console.log("👁️ Monitoreo de presencia (WebRTC) activado");
  };

  const handleLogout = () => {
    stopWebRTC();

    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("last_recognition");

    alert("Sesión cerrada: no se detectó tu presencia");

    navigate("/");
  };

  return null; // No necesitamos renderizar nada visible
}

export default FaceMonitorRTC;
