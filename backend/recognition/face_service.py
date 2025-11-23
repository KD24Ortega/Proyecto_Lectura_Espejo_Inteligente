import os
import cv2
import pickle
import numpy as np
import face_recognition
from mediapipe import solutions as mp_solutions


class FaceRecognitionService:

    def __init__(self):
        print("🔵 Inicializando FaceRecognition con MediaPipe Solutions + face_recognition")

        # -----------------------------------------------
        # 📌 MediaPipe Solutions (API estable)
        # -----------------------------------------------
        self.mp_detection = mp_solutions.face_detection # type: ignore
        self.detector = self.mp_detection.FaceDetection(
            model_selection=1,     # 0 = corto alcance / 1 = largo alcance
            min_detection_confidence=0.55
        )

        # -----------------------------------------------
        # 📌 Encodings
        # -----------------------------------------------
        self.enc_file = "backend/recognition/data/encodings.pkl"
        os.makedirs("backend/recognition/data", exist_ok=True)

        self.known_encodings = []
        self.known_users = []

        self._load_encodings()

        # -----------------------------------------------
        # 📌 Cámara
        # -----------------------------------------------
        self.cap = cv2.VideoCapture(0)
        self.cap.set(3, 640)
        self.cap.set(4, 480)

        print("✓ Cámara inicializada (640x480)")

    # ============================================================
    # 🔹 Encodings
    # ============================================================
    def _load_encodings(self):
        if os.path.exists(self.enc_file):
            with open(self.enc_file, "rb") as f:
                data = pickle.load(f)
                self.known_encodings = data["encodings"]
                self.known_users = data["users"]
            print(f"✓ Encodings cargados: {len(self.known_users)} usuarios")
        else:
            print("ℹ No existe encodings.pkl — Se creará uno nuevo.")

    def _save_encodings(self):
        data = {
            "encodings": self.known_encodings,
            "users": self.known_users
        }
        with open(self.enc_file, "wb") as f:
            pickle.dump(data, f)
        print("💾 Encodings guardados.")

    # ============================================================
    # 🔹 Detectar rostro (MediaPipe Solutions)
    # ============================================================
    def _detect_face(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb)

        if not results.detections:
            return None

        h, w, _ = frame.shape
        detection = results.detections[0]
        box = detection.location_data.relative_bounding_box

        x1 = int(box.xmin * w)
        y1 = int(box.ymin * h)
        x2 = int((box.xmin + box.width) * w)
        y2 = int((box.ymin + box.height) * h)

        # expandir un poco la caja (para capturar toda la cabeza)
        expand = 40
        x1 -= expand
        y1 -= expand
        x2 += expand
        y2 += expand

        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)

        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            return None

        return face

    # ============================================================
    # 🔹 Registrar usuario
    # ============================================================
    def register(self, username, frame):

        face_img = self._detect_face(frame)

        if face_img is None:
            return {"success": False, "message": "No se detectó rostro"}

        rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        enc = face_recognition.face_encodings(rgb)

        if len(enc) == 0:
            return {"success": False, "message": "No se pudo generar encoding"}

        self.known_users.append(username)
        self.known_encodings.append(enc[0])
        self._save_encodings()

        return {"success": True, "message": f"Usuario {username} registrado"}

    # ============================================================
    # 🔹 Reconocimiento facial
    # ============================================================
    def recognize(self, frame):

        face_img = self._detect_face(frame)

        if face_img is None:
            return {"found": False, "user": None, "confidence": 0}

        rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        enc = face_recognition.face_encodings(rgb)

        if len(enc) == 0:
            return {"found": True, "user": None, "confidence": 0}

        encoding = enc[0]

        if len(self.known_encodings) == 0:
            return {"found": True, "user": None, "confidence": 0}

        distances = face_recognition.face_distance(self.known_encodings, encoding)
        idx = np.argmin(distances)
        dist = distances[idx]

        confidence = float(1 - dist)

        if dist < 0.48:     # Umbral recomendado
            return {
                "found": True,
                "user": self.known_users[idx],
                "confidence": confidence
            }

        return {"found": True, "user": None, "confidence": confidence}

    # ============================================================
    # 🔹 Leer frame
    # ============================================================
    def read_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return None
        return cv2.flip(frame, 1)

    # ============================================================
    # 🔹 Cerrar cámara
    # ============================================================
    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()
