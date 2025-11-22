import cv2
import mediapipe as mp
import numpy as np
import pickle
from pathlib import Path

ENCODINGS_PATH = Path("data/encodings.pkl")

mp_face = mp.solutions.face_detection


class FaceService:
    def __init__(self):
        self.detector = mp_face.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.6
        )
        self.known_embeddings = []
        self.known_ids = []
        self._load_encodings()

    def _load_encodings(self):
        if ENCODINGS_PATH.exists():
            data = pickle.load(open(ENCODINGS_PATH, "rb"))
            self.known_embeddings = data["embeddings"]
            self.known_ids = data["user_ids"]

    def _save_encodings(self):
        ENCODINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "embeddings": self.known_embeddings,
            "user_ids": self.known_ids
        }
        pickle.dump(data, open(ENCODINGS_PATH, "wb"))

    # TODO: aquí luego conectamos TensorFlow (FaceNet / MobileFaceNet)
    def _dummy_embedding(self, face_img: np.ndarray) -> np.ndarray:
        """
        Embedding de prueba: a futuro se reemplaza por modelo TensorFlow.
        De momento solo aplana y normaliza para probar el flujo.
        """
        resized = cv2.resize(face_img, (32, 32))
        vec = resized.flatten().astype("float32")
        vec /= np.linalg.norm(vec) + 1e-8
        return vec

    def register_user(self, user_id: int, num_samples: int = 5):
        cap = cv2.VideoCapture(0)

        samples = []
        print(f"📸 Mira a la cámara. Se capturarán {num_samples} ejemplos.")

        while len(samples) < num_samples:
            ret, frame = cap.read()
            if not ret:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.detector.process(rgb)

            if results.detections:
                h, w, _ = frame.shape
                detection = results.detections[0]
                box = detection.location_data.relative_bounding_box
                x1 = int(box.xmin * w)
                y1 = int(box.ymin * h)
                x2 = int((box.xmin + box.width) * w)
                y2 = int((box.ymin + box.height) * h)

                face = frame[max(0, y1):y2, max(0, x1):x2]
                if face.size > 0:
                    emb = self._dummy_embedding(face)
                    samples.append(emb)
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, f"Sample {len(samples)}",
                                (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            cv2.imshow("Register user", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()

        if not samples:
            print("❌ No se capturaron muestras")
            return

        avg_emb = np.mean(samples, axis=0)
        self.known_embeddings.append(avg_emb)
        self.known_ids.append(user_id)
        self._save_encodings()
        print(f"✅ Usuario {user_id} registrado con {len(samples)} muestras")

    def recognize_loop(self):
        cap = cv2.VideoCapture(0)

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.detector.process(rgb)

            if results.detections:
                h, w, _ = frame.shape

                for detection in results.detections:
                    box = detection.location_data.relative_bounding_box
                    x1 = int(box.xmin * w)
                    y1 = int(box.ymin * h)
                    x2 = int((box.xmin + box.width) * w)
                    y2 = int((box.ymin + box.height) * h)

                    face = frame[max(0, y1):y2, max(0, x1):x2]
                    label = "Desconocido"

                    if face.size > 0 and self.known_embeddings:
                        emb = self._dummy_embedding(face)

                        sims = [
                            float(np.dot(emb, k) /
                                  (np.linalg.norm(emb) * np.linalg.norm(k) + 1e-8))
                            for k in self.known_embeddings
                        ]
                        best_idx = int(np.argmax(sims))
                        best_sim = sims[best_idx]

                        if best_sim > 0.7:   # umbral provisional
                            label = f"User {self.known_ids[best_idx]} ({best_sim:.2f})"

                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, label, (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            cv2.imshow("Recognition", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()
