import os
import cv2
import pickle
import numpy as np
import face_recognition
from mediapipe import solutions as mp_solutions


def align_face(image):
    landmarks = face_recognition.face_landmarks(image)

    if len(landmarks) == 0:
        return image

    left_eye = landmarks[0].get("left_eye")
    right_eye = landmarks[0].get("right_eye")

    if not left_eye or not right_eye:
        return image

    left_center = np.mean(left_eye, axis=0)
    right_center = np.mean(right_eye, axis=0)

    left_center = (int(left_center[0]), int(left_center[1]))
    right_center = (int(right_center[0]), int(right_center[1]))

    dy = right_center[1] - left_center[1]
    dx = right_center[0] - left_center[0]
    angle = np.degrees(np.arctan2(dy, dx))

    rot_matrix = cv2.getRotationMatrix2D(left_center, angle, 1.0)
    aligned = cv2.warpAffine(
        image,
        rot_matrix,
        (image.shape[1], image.shape[0]),
        flags=cv2.INTER_LINEAR
    )
    return aligned


def enhance_image(image):
    image = cv2.GaussianBlur(image, (3, 3), 0)
    image = cv2.convertScaleAbs(image, alpha=1.15, beta=6)
    return image


class FaceRecognitionService:

    def __init__(self):
        print("🔵 Inicializando FaceRecognitionService...")

        self.mp_detection = mp_solutions.face_detection
        self.detector = self.mp_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.45
        )

        self.enc_file = "backend/recognition/data/encodings.pkl"
        self.known_encodings = []
        self.known_users = []

        self._load_encodings()

        self.cap = None


    # ============================================================
    # Loading encodings
    # ============================================================
    def _load_encodings(self):
        if os.path.exists(self.enc_file):
            with open(self.enc_file, "rb") as f:
                data = pickle.load(f)
                self.known_encodings = data["encodings"]
                self.known_users = data["users"]
            print(f"✅ Encodings cargados: {len(self.known_users)} usuarios")
        else:
            print("ℹ️ No existe encodings.pkl — se iniciará vacío")

    def _save_encodings(self):
        data = {"encodings": self.known_encodings, "users": self.known_users}
        with open(self.enc_file, "wb") as f:
            pickle.dump(data, f)
        print("💾 Encodings guardados")


    # ============================================================
    # Detection
    # ============================================================
    def _detect_face(self, frame):

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb)

        if not results.detections:
            return None

        h, w, _ = frame.shape
        box = results.detections[0].location_data.relative_bounding_box

        x1 = int(box.xmin * w)
        y1 = int(box.ymin * h)
        x2 = int((box.xmin + box.width) * w)
        y2 = int((box.ymin + box.height) * h)

        expand = 35
        x1 = max(0, x1 - expand)
        y1 = max(0, y1 - expand)
        x2 = min(w, x2 + expand)
        y2 = min(h, y2 + expand)

        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            return None

        return face


    # ============================================================
    # Register
    # ============================================================
    def register(self, username, frame):

        face_img = self._detect_face(frame)

        if face_img is None:
            return {"success": False, "message": "No se detectó rostro"}

        face_img = enhance_image(face_img)
        face_img = align_face(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))

        enc = face_recognition.face_encodings(face_img)

        if not enc:
            return {"success": False, "message": "No se pudo generar encoding"}

        self.known_users.append(username)
        self.known_encodings.append(enc[0])
        self._save_encodings()

        return {"success": True}


    # ============================================================
    # Recognize
    # ============================================================
    def recognize(self, frame):

        # convertir a RGB directo
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # detectar caras directamente con face_recognition
        locations = face_recognition.face_locations(rgb)

        if not locations:
            return {"found": False, "user": None, "confidence": 0}

        encodings = face_recognition.face_encodings(rgb, locations)

        if not encodings:
            return {"found": True, "user": None, "confidence": 0}

        encoding = encodings[0]

        if not self.known_encodings:
            return {"found": True, "user": None, "confidence": 0}

        distances = face_recognition.face_distance(self.known_encodings, encoding)

        idx = int(np.argmin(distances))
        dist = float(distances[idx])

        confidence = max(0.0, 1 - dist)

        THRESHOLD = 0.62   # válido para video

        if dist <= THRESHOLD:
            print(f"✅ MATCH | dist={dist:.3f}")
            return {
                "found": True,
                "user": self.known_users[idx],
                "confidence": confidence
            }

        print(f"❌ NO MATCH | dist={dist:.3f}")

        return {"found": True, "user": None, "confidence": confidence}


    # ============================================================
    # Remove
    # ============================================================
    def remove_encoding(self, name):
        if name in self.known_users:
            idx = self.known_users.index(name)
            del self.known_users[idx]
            del self.known_encodings[idx]
            self._save_encodings()
            print(f"✅ Encoding eliminado: {name}")
            return True
        return False
