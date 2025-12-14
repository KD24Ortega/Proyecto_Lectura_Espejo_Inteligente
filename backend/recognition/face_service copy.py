# =====================================================
#  SERVICIO DE RECONOCIMIENTO FACIAL MEJORADO
#  Versión 2.0 - Mayor precisión y confiabilidad
# =====================================================

import os
import cv2
import pickle
import numpy as np
import face_recognition
from mediapipe import solutions as mp_solutions
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
from datetime import datetime


def align_face(image):
    """Alinea el rostro basándose en la posición de los ojos"""
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
    """Mejora la calidad de la imagen"""
    # Reducir ruido
    image = cv2.GaussianBlur(image, (3, 3), 0)
    # Mejorar contraste
    image = cv2.convertScaleAbs(image, alpha=1.15, beta=6)
    return image


def assess_image_quality(frame) -> Dict[str, any]:
    """
    Evalúa la calidad de la imagen para reconocimiento facial.
    Retorna un diccionario con métricas de calidad.
    """
    # Convertir a escala de grises para análisis
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # 1. Verificar brillo
    brightness = np.mean(gray)
    
    # 2. Calcular nitidez (usando Laplacian)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    # 3. Verificar contraste
    contrast = gray.std()
    
    # 4. Verificar tamaño mínimo
    height, width = frame.shape[:2]
    
    quality_score = 0
    issues = []
    
    # Evaluación de brillo (óptimo: 80-180)
    if brightness < 60:
        issues.append("Imagen muy oscura")
    elif brightness > 200:
        issues.append("Imagen muy brillante")
    else:
        quality_score += 25
    
    # Evaluación de nitidez (óptimo: > 100)
    if laplacian_var < 50:
        issues.append("Imagen borrosa o desenfocada")
    else:
        quality_score += 25
    
    # Evaluación de contraste (óptimo: > 30)
    if contrast < 20:
        issues.append("Contraste muy bajo")
    else:
        quality_score += 25
    
    # Evaluación de tamaño (mínimo: 200x200)
    if width < 200 or height < 200:
        issues.append("Imagen muy pequeña")
    else:
        quality_score += 25
    
    return {
        "score": quality_score,
        "brightness": brightness,
        "sharpness": laplacian_var,
        "contrast": contrast,
        "size": (width, height),
        "issues": issues,
        "is_acceptable": quality_score >= 50  # Al menos 50/100
    }


class FaceRecognitionService:
    
    def __init__(self):
        print("🔵 Inicializando FaceRecognitionService v2.0...")

        self.mp_detection = mp_solutions.face_detection
        self.detector = self.mp_detection.FaceDetection(
            model_selection=1,  # Modelo 1 = mejor precisión (vs 0 = más rápido)
            min_detection_confidence=0.6  # Más estricto (era 0.45)
        )

        self.enc_file = "backend/recognition/data/encodings.pkl"
        
        # Estructura mejorada: múltiples encodings por usuario
        self.user_encodings = defaultdict(list)  # {username: [enc1, enc2, enc3]}
        self.user_metadata = {}  # {username: {created_at, num_encodings}}
        
        self._load_encodings()
        
        # Sistema de verificación temporal
        self.recognition_buffer = defaultdict(list)  # Para tracking de frames
        
        # Configuración de umbrales
        self.RECOGNITION_THRESHOLD = 0.50  # MÁS ESTRICTO (era 0.62, menor es mejor)
        self.MIN_CONFIDENCE = 0.55  # Confianza mínima para aceptar match
        self.MARGIN_THRESHOLD = 0.08  # Margen mínimo entre mejor y segundo mejor match
        
        print(f"✅ Servicio inicializado con umbrales:")
        print(f"   - Distancia máxima: {self.RECOGNITION_THRESHOLD}")
        print(f"   - Confianza mínima: {self.MIN_CONFIDENCE}")
        print(f"   - Margen de seguridad: {self.MARGIN_THRESHOLD}")


    # ============================================================
    # Loading/Saving encodings
    # ============================================================
    def _load_encodings(self):
        """Carga encodings del archivo pickle"""
        if os.path.exists(self.enc_file):
            try:
                with open(self.enc_file, "rb") as f:
                    data = pickle.load(f)
                
                # Compatibilidad con formato antiguo
                if "encodings" in data and "users" in data:
                    # Formato antiguo: convertir a nuevo formato
                    for user, enc in zip(data["users"], data["encodings"]):
                        self.user_encodings[user].append(enc)
                        self.user_metadata[user] = {
                            "created_at": datetime.now().isoformat(),
                            "num_encodings": 1
                        }
                else:
                    # Formato nuevo
                    self.user_encodings = data.get("user_encodings", defaultdict(list))
                    self.user_metadata = data.get("user_metadata", {})
                
                total_users = len(self.user_encodings)
                total_encodings = sum(len(encs) for encs in self.user_encodings.values())
                print(f"✅ Encodings cargados: {total_users} usuarios, {total_encodings} encodings totales")
                
            except Exception as e:
                print(f"⚠️ Error cargando encodings: {e}")
                self.user_encodings = defaultdict(list)
                self.user_metadata = {}
        else:
            print("ℹ️ No existe encodings.pkl — se iniciará vacío")

    def _save_encodings(self):
        """Guarda encodings en archivo pickle"""
        try:
            # Crear directorio si no existe
            os.makedirs(os.path.dirname(self.enc_file), exist_ok=True)
            
            data = {
                "user_encodings": dict(self.user_encodings),
                "user_metadata": self.user_metadata
            }
            
            with open(self.enc_file, "wb") as f:
                pickle.dump(data, f)
            
            total_encodings = sum(len(encs) for encs in self.user_encodings.values())
            print(f"💾 Encodings guardados: {len(self.user_encodings)} usuarios, {total_encodings} encodings")
            
        except Exception as e:
            print(f"❌ Error guardando encodings: {e}")


    # ============================================================
    # Detection con validación de calidad
    # ============================================================
    def _detect_face(self, frame) -> Optional[np.ndarray]:
        """Detecta y extrae el rostro del frame con validación de calidad"""
        
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

        # Expansión del recorte
        expand = 40  # Más margen (era 35)
        x1 = max(0, x1 - expand)
        y1 = max(0, y1 - expand)
        x2 = min(w, x2 + expand)
        y2 = min(h, y2 + expand)

        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            return None

        return face


    # ============================================================
    # Register con múltiples capturas
    # ============================================================
    def register(self, username: str, frame: np.ndarray, num_samples: int = 1) -> Dict:
        """
        Registra un usuario con múltiples muestras para mayor precisión.
        
        Args:
            username: Nombre del usuario
            frame: Frame de la cámara
            num_samples: Número de muestras a capturar (1 para compatibilidad)
        
        Returns:
            Dict con success, message y opcionalmente quality_info
        """
        
        # Evaluar calidad de imagen
        quality = assess_image_quality(frame)
        
        if not quality["is_acceptable"]:
            return {
                "success": False,
                "message": f"Calidad de imagen insuficiente: {', '.join(quality['issues'])}",
                "quality_info": quality
            }
        
        # Detectar rostro
        face_img = self._detect_face(frame)

        if face_img is None:
            return {
                "success": False,
                "message": "No se detectó rostro en la imagen",
                "quality_info": quality
            }

        # Mejorar y alinear imagen
        face_img = enhance_image(face_img)
        face_img_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        face_img_aligned = align_face(face_img_rgb)

        # Generar encoding
        encodings = face_recognition.face_encodings(face_img_aligned)

        if not encodings:
            return {
                "success": False,
                "message": "No se pudo generar encoding del rostro",
                "quality_info": quality
            }

        # Verificar si el rostro ya está registrado para otro usuario
        if len(self.user_encodings) > 0:
            all_encodings = []
            all_users = []
            
            for user, encs in self.user_encodings.items():
                all_encodings.extend(encs)
                all_users.extend([user] * len(encs))
            
            if all_encodings:
                distances = face_recognition.face_distance(all_encodings, encodings[0])
                min_dist_idx = int(np.argmin(distances))
                min_distance = float(distances[min_dist_idx])
                
                # Si el rostro es muy similar a uno existente
                if min_distance < self.RECOGNITION_THRESHOLD:
                    existing_user = all_users[min_dist_idx]
                    if existing_user != username:
                        return {
                            "success": False,
                            "message": f"Este rostro ya está registrado para el usuario '{existing_user}'",
                            "quality_info": quality
                        }

        # Agregar encoding al usuario
        self.user_encodings[username].append(encodings[0])
        
        # Actualizar metadata
        self.user_metadata[username] = {
            "created_at": datetime.now().isoformat(),
            "num_encodings": len(self.user_encodings[username]),
            "last_updated": datetime.now().isoformat()
        }
        
        self._save_encodings()

        return {
            "success": True,
            "message": f"Rostro registrado exitosamente ({len(self.user_encodings[username])} muestras)",
            "quality_info": quality
        }


    # ============================================================
    # Recognize MEJORADO con validación estricta
    # ============================================================
    def recognize(self, frame: np.ndarray, require_quality_check: bool = True) -> Dict:
        """
        Reconoce un rostro en el frame con validaciones estrictas.
        
        Args:
            frame: Frame de la cámara
            require_quality_check: Si True, valida calidad de imagen
        
        Returns:
            Dict con found, user, confidence, y metadata adicional
        """
        
        # Opcional: verificar calidad
        if require_quality_check:
            quality = assess_image_quality(frame)
            if not quality["is_acceptable"]:
                return {
                    "found": False,
                    "user": None,
                    "confidence": 0,
                    "message": "Calidad de imagen insuficiente",
                    "quality_info": quality
                }
        
        # Convertir a RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Detectar caras
        locations = face_recognition.face_locations(rgb, model="hog")

        if not locations:
            return {
                "found": False,
                "user": None,
                "confidence": 0,
                "message": "No se detectó rostro"
            }

        # Obtener encodings
        encodings = face_recognition.face_encodings(rgb, locations)

        if not encodings:
            return {
                "found": True,
                "user": None,
                "confidence": 0,
                "message": "No se pudo generar encoding"
            }

        encoding = encodings[0]

        # Verificar si hay usuarios registrados
        if not self.user_encodings:
            return {
                "found": True,
                "user": None,
                "confidence": 0,
                "message": "No hay usuarios registrados"
            }

        # Preparar todos los encodings
        all_encodings = []
        all_users = []
        
        for user, encs in self.user_encodings.items():
            all_encodings.extend(encs)
            all_users.extend([user] * len(encs))

        # Calcular distancias
        distances = face_recognition.face_distance(all_encodings, encoding)
        
        # Obtener los mejores matches
        sorted_indices = np.argsort(distances)
        best_idx = sorted_indices[0]
        best_distance = float(distances[best_idx])
        best_user = all_users[best_idx]
        
        # Calcular confianza
        confidence = max(0.0, 1.0 - best_distance)
        
        # VALIDACIÓN 1: Verificar umbral de distancia
        if best_distance > self.RECOGNITION_THRESHOLD:
            print(f"❌ NO MATCH | dist={best_distance:.3f} > threshold={self.RECOGNITION_THRESHOLD}")
            return {
                "found": True,
                "user": None,
                "confidence": confidence,
                "message": f"No hay coincidencia (distancia: {best_distance:.3f})"
            }
        
        # VALIDACIÓN 2: Verificar confianza mínima
        if confidence < self.MIN_CONFIDENCE:
            print(f"❌ NO MATCH | confianza={confidence:.3f} < mínima={self.MIN_CONFIDENCE}")
            return {
                "found": True,
                "user": None,
                "confidence": confidence,
                "message": f"Confianza insuficiente ({confidence:.2%})"
            }
        
        # VALIDACIÓN 3: Margen de seguridad entre usuarios
        # Verificar que el segundo mejor match sea significativamente peor
        if len(sorted_indices) > 1:
            second_best_idx = sorted_indices[1]
            second_best_distance = float(distances[second_best_idx])
            second_best_user = all_users[second_best_idx]
            
            # Si el segundo mejor es de OTRO usuario y está muy cerca
            if second_best_user != best_user:
                margin = second_best_distance - best_distance
                
                if margin < self.MARGIN_THRESHOLD:
                    print(f"⚠️ AMBIGUO | margin={margin:.3f} < threshold={self.MARGIN_THRESHOLD}")
                    print(f"   Usuario 1: {best_user} (dist={best_distance:.3f})")
                    print(f"   Usuario 2: {second_best_user} (dist={second_best_distance:.3f})")
                    return {
                        "found": True,
                        "user": None,
                        "confidence": confidence,
                        "message": "Reconocimiento ambiguo entre múltiples usuarios",
                        "ambiguous": True,
                        "candidates": [
                            {"user": best_user, "distance": best_distance},
                            {"user": second_best_user, "distance": second_best_distance}
                        ]
                    }

        # ✅ MATCH EXITOSO
        print(f"✅ MATCH | user={best_user} | dist={best_distance:.3f} | conf={confidence:.3f}")
        
        return {
            "found": True,
            "user": best_user,
            "confidence": confidence,
            "distance": best_distance,
            "message": "Usuario reconocido exitosamente"
        }


    # ============================================================
    # Recognize con verificación multi-frame (RECOMENDADO para login)
    # ============================================================
    def recognize_verified(self, frame: np.ndarray, user_id: str = "default", 
                          required_frames: int = 3) -> Dict:
        """
        Reconocimiento con verificación de múltiples frames para mayor seguridad.
        Útil para evitar falsos positivos en el login.
        
        Args:
            frame: Frame de la cámara
            user_id: ID de sesión para tracking
            required_frames: Número de frames consecutivos necesarios
        
        Returns:
            Dict con el resultado del reconocimiento
        """
        
        # Reconocer frame actual
        result = self.recognize(frame, require_quality_check=True)
        
        # Agregar al buffer
        self.recognition_buffer[user_id].append({
            "user": result.get("user"),
            "confidence": result.get("confidence", 0),
            "timestamp": datetime.now()
        })
        
        # Mantener solo los últimos N frames
        if len(self.recognition_buffer[user_id]) > required_frames:
            self.recognition_buffer[user_id].pop(0)
        
        # Si no tenemos suficientes frames, retornar el resultado simple
        if len(self.recognition_buffer[user_id]) < required_frames:
            return {
                **result,
                "verified": False,
                "frames_remaining": required_frames - len(self.recognition_buffer[user_id])
            }
        
        # Verificar consistencia en los últimos N frames
        recent_users = [f["user"] for f in self.recognition_buffer[user_id][-required_frames:]]
        avg_confidence = np.mean([f["confidence"] for f in self.recognition_buffer[user_id][-required_frames:]])
        
        # Verificar que todos los frames reconozcan al mismo usuario
        if recent_users.count(recent_users[0]) == required_frames and recent_users[0] is not None:
            # Limpiar buffer
            self.recognition_buffer[user_id] = []
            
            return {
                **result,
                "verified": True,
                "avg_confidence": avg_confidence,
                "message": f"Usuario verificado en {required_frames} frames consecutivos"
            }
        
        return {
            **result,
            "verified": False,
            "message": "Inconsistencia en el reconocimiento, intente de nuevo"
        }


    # ============================================================
    # Add encoding (agregar más muestras a usuario existente)
    # ============================================================
    def add_encoding(self, username: str, frame: np.ndarray) -> Dict:
        """
        Agrega una muestra adicional a un usuario existente.
        Útil para mejorar la precisión con el tiempo.
        """
        
        if username not in self.user_encodings:
            return {
                "success": False,
                "message": f"Usuario '{username}' no existe"
            }
        
        # Usar el método register que ya valida calidad
        result = self.register(username, frame, num_samples=1)
        
        return result


    # ============================================================
    # Remove encoding
    # ============================================================
    def remove_encoding(self, username: str) -> bool:
        """Elimina todos los encodings de un usuario"""
        if username in self.user_encodings:
            del self.user_encodings[username]
            if username in self.user_metadata:
                del self.user_metadata[username]
            self._save_encodings()
            print(f"✅ Encodings eliminados: {username}")
            return True
        return False


    # ============================================================
    # Estadísticas y diagnóstico
    # ============================================================
    def get_stats(self) -> Dict:
        """Retorna estadísticas del sistema"""
        total_users = len(self.user_encodings)
        total_encodings = sum(len(encs) for encs in self.user_encodings.values())
        avg_encodings = total_encodings / total_users if total_users > 0 else 0
        
        return {
            "total_users": total_users,
            "total_encodings": total_encodings,
            "avg_encodings_per_user": round(avg_encodings, 2),
            "users": list(self.user_encodings.keys()),
            "config": {
                "recognition_threshold": self.RECOGNITION_THRESHOLD,
                "min_confidence": self.MIN_CONFIDENCE,
                "margin_threshold": self.MARGIN_THRESHOLD
            }
        }