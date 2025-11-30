import os
import cv2
import pickle
import numpy as np
import face_recognition
from mediapipe import solutions as mp_solutions


# ============================================================
# ⭐ MEJORA 1: Alinear rostro usando los ojos
# ============================================================
def align_face(image):
    """
    Alinea el rostro usando los ojos detectados por face_recognition.
    Si no se encuentran puntos, devuelve la imagen original.
    """

    landmarks = face_recognition.face_landmarks(image)

    if len(landmarks) == 0:
        return image

    left_eye = landmarks[0].get("left_eye")
    right_eye = landmarks[0].get("right_eye")

    if not left_eye or not right_eye:
        return image

    # calcular centros
    left_center = np.mean(left_eye, axis=0)
    right_center = np.mean(right_eye, axis=0)

    # convertir a tupla de enteros
    left_center = (int(left_center[0]), int(left_center[1]))
    right_center = (int(right_center[0]), int(right_center[1]))

    # ángulo
    dy = right_center[1] - left_center[1]
    dx = right_center[0] - left_center[0]
    angle = np.degrees(np.arctan2(dy, dx))

    # rotar imagen
    rot_matrix = cv2.getRotationMatrix2D(left_center, angle, 1.0)
    aligned = cv2.warpAffine(
        image,
        rot_matrix,
        (image.shape[1], image.shape[0]),
        flags=cv2.INTER_LINEAR
    )
    return aligned


# ============================================================
# ⭐ MEJORA 2: Ajuste de iluminación
# ============================================================
def enhance_image(image):
    """
    Leve aumento de contraste y reducción de ruido.
    """
    image = cv2.GaussianBlur(image, (3, 3), 0)
    image = cv2.convertScaleAbs(image, alpha=1.25, beta=10)
    return image


# ============================================================
# ⭐ SERVICIO PRINCIPAL
# ============================================================
class FaceRecognitionService:

    def __init__(self):
        print("🔵 Inicializando FaceRecognition Optimizado...")

        # -------------------------------------------
        # MediaPipe Solutions — Face Detection
        # -------------------------------------------
        self.mp_detection = mp_solutions.face_detection # type: ignore
        self.detector = self.mp_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.60
        )

        # -------------------------------------------
        # Encodings
        # -------------------------------------------
        self.enc_file = "backend/recognition/data/encodings.pkl"
        self.known_encodings = []
        self.known_users = []

        self._load_encodings()

        # -------------------------------------------
        # Cámara (para modo demo local)
        # -------------------------------------------
        self.cap = cv2.VideoCapture(0)
        self.cap.set(3, 640)
        self.cap.set(4, 480)
        print("✓ Cámara inicializada (640x480)")

    # ============================================================
    # Encodings
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
        data = {"encodings": self.known_encodings, "users": self.known_users}
        with open(self.enc_file, "wb") as f:
            pickle.dump(data, f)
        print("💾 Encodings guardados.")

    # ============================================================
    # Detección de rostro (MediaPipe)
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

        # expandir un poco la caja
        expand = 40
        x1 -= expand
        y1 -= expand
        x2 += expand
        y2 += expand

        # límites
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)

        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            return None

        return face

    # ============================================================
    # Registrar usuario
    # ============================================================
    def register(self, username, frame):

        face_img = self._detect_face(frame)
        if face_img is None:
            return {"success": False, "message": "No se detectó rostro"}

        face_img = enhance_image(face_img)
        face_img = align_face(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))

        enc = face_recognition.face_encodings(face_img)

        if len(enc) == 0:
            return {"success": False, "message": "No se pudo generar encoding"}

        self.known_users.append(username)
        self.known_encodings.append(enc[0])
        self._save_encodings()

        return {"success": True, "message": f"Usuario {username} registrado"}

    # ============================================================
    # Reconocimiento facial
    # ============================================================
    def recognize(self, frame):
        face_img = self._detect_face(frame)

        if face_img is None:
            return {"found": False, "user": None, "confidence": 0}

        face_img = enhance_image(face_img)
        aligned = align_face(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))

        enc = face_recognition.face_encodings(aligned)

        if len(enc) == 0:
            return {"found": True, "user": None, "confidence": 0}

        encoding = enc[0]

        if len(self.known_encodings) == 0:
            return {"found": True, "user": None, "confidence": 0}

        distances = face_recognition.face_distance(self.known_encodings, encoding)
        idx = np.argmin(distances)
        dist = distances[idx]

        # Umbral dinámico
        THRESHOLD = 0.50

        confidence = float(1 - dist)

        if dist < THRESHOLD:
            return {
                "found": True,
                "user": self.known_users[idx],
                "confidence": confidence
            }

        return {"found": True, "user": None, "confidence": confidence}

    # ============================================================
    # Cámara
    # ============================================================
    def read_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return None
        return cv2.flip(frame, 1)

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()
        
        
    def remove_encoding(self, name):
        """Eliminar encoding de un usuario"""
        if name in self.known_users:  # ← Cambiar known_names por known_users
            idx = self.known_users.index(name)  # ← Cambiar
            del self.known_users[idx]  # ← Cambiar
            del self.known_encodings[idx]
            self._save_encodings()
            print(f"✓ Encoding de {name} eliminado")
            return True
        print(f"⚠️ Encoding de {name} no encontrado")
        return False
