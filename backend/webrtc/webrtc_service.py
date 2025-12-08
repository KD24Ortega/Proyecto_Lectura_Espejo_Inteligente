# backend/webrtc/webrtc_service.py

import asyncio
from datetime import datetime
from typing import Dict, Any

import numpy as np
import cv2
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaBlackhole
from av import VideoFrame

from backend.recognition.face_service import FaceRecognitionService

# ============================
# Estado global de presencia
# ============================

# presence_state[client_id] = {
#   "found": bool,
#   "user": str | None,
#   "confidence": float,
#   "last_update": str (ISO),
#   "error": str | None
# }
presence_state: Dict[str, Dict[str, Any]] = {}

# Instancia compartida de FaceRecognitionService
face_service = FaceRecognitionService()


class VideoPresenceTrack(MediaStreamTrack):
    """
    Track de vídeo que recibe frames WebRTC y hace reconocimiento facial
    con face_service. Actualiza presence_state[client_id].
    """

    kind = "video"

    def __init__(self, track: MediaStreamTrack, client_id: str):
        super().__init__()  # inicializa MediaStreamTrack
        self.track = track
        self.client_id = client_id

        # Para no procesar TODOS los frames (evitar carga CPU)
        self._frame_count = 0
        self._process_every = 5  # procesar 1 de cada 5 frames

        print(f"🎥 VideoPresenceTrack creado para client_id={client_id}")

    async def recv(self):
        """
        Recibe un frame del stream WebRTC, procesa cada N frames
        y actualiza presence_state[client_id].
        """
        frame = await self.track.recv()
        self._frame_count += 1

        # Solo procesamos frames de vídeo cada N iteraciones
        if isinstance(frame, VideoFrame) and (self._frame_count % self._process_every == 0):
            try:
                # 🔹 Conversión robusta: frame → numpy RGB → BGR
                array = frame.to_ndarray(format="rgb24")

                if array is None or array.size == 0:
                    # Frame vacío, no hacemos nada
                    return frame

                img = np.ascontiguousarray(array, dtype=np.uint8)
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

                # 🔹 Llamada directa a tu servicio de reconocimiento
                result = face_service.recognize(img)

                # 🔹 Actualizar presencia
                presence_state[self.client_id] = {
                    "found": bool(result.get("found", False)),
                    "user": result.get("user"),
                    "confidence": float(result.get("confidence", 0.0)),
                    "last_update": datetime.utcnow().isoformat(),
                    "error": None
                }

                print(
                    f"👁️ [{self.client_id}] found={presence_state[self.client_id]['found']} "
                    f"user={presence_state[self.client_id]['user']} "
                    f"conf={presence_state[self.client_id]['confidence']:.3f}"
                )

            except Exception as e:
                print(f"❌ Error procesando frame WebRTC ({self.client_id}):", e)
                presence_state[self.client_id] = {
                    "found": False,
                    "user": None,
                    "confidence": 0.0,
                    "last_update": datetime.utcnow().isoformat(),
                    "error": str(e)
                }

        # Siempre devolvemos el frame para que el pipeline siga vivo
        return frame


async def handle_webrtc_offer(offer_sdp: str, offer_type: str, client_id: str):
    """
    Maneja una SDP offer WebRTC desde el cliente.
    Crea el PeerConnection, engancha el track de vídeo y responde con la SDP answer.
    """

    pc = RTCPeerConnection()
    media_sink = MediaBlackhole()  # Consumidor de media (obliga a leer los frames)

    print(f"📡 Creando PeerConnection para client_id={client_id}")

    @pc.on("track")
    def on_track(track):
        print(f"📹 Track recibido: kind={track.kind} para client_id={client_id}")
        if track.kind == "video":
            local_video = VideoPresenceTrack(track, client_id)
            media_sink.addTrack(local_video)

    # 🔹 Arrancar el MediaBlackhole para que sí se llamen a recv()
    asyncio.create_task(media_sink.start())
    print(f"🌀 MediaBlackhole.start() lanzado para client_id={client_id}")

    offer = RTCSessionDescription(sdp=offer_sdp, type=offer_type)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"📡 WebRTC state ({client_id}):", pc.connectionState)
        if pc.connectionState in ("failed", "closed", "disconnected"):
            await media_sink.stop()
            await pc.close()
            print(f"🧹 PeerConnection cerrado para client_id={client_id}")

    # Devolvemos la SDP answer al cliente
    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    }
