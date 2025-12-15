#!/usr/bin/env python3
# =====================================================
#  FACE RECOGNITION SERVICE v3.0 - Database Edition
#  Almacena encodings en PostgreSQL en lugar de pickle
# =====================================================

import cv2
import numpy as np
import threading
import face_recognition
from mediapipe import solutions as mp_solutions
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

# Importar modelos de base de datos
from backend.db import models


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
    image = cv2.GaussianBlur(image, (3, 3), 0)
    image = cv2.convertScaleAbs(image, alpha=1.15, beta=6)
    return image


def assess_image_quality(frame) -> Dict[str, any]:
    """Evalúa la calidad de la imagen para reconocimiento facial"""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    brightness = np.mean(gray)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    contrast = gray.std()
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
        "is_acceptable": quality_score >= 50
    }


class FaceRecognitionService:
    _detector_lock = threading.Lock()
    _shared_detector = None

    def __init__(self, db: Session):
        self.db = db

        if FaceRecognitionService._shared_detector is None:
            with FaceRecognitionService._detector_lock:
                if FaceRecognitionService._shared_detector is None:
                    FaceRecognitionService._shared_detector = mp_solutions.face_detection.FaceDetection(
                        model_selection=1,
                        min_detection_confidence=0.6
                    )

        self.detector = FaceRecognitionService._shared_detector
        
        # Configuración de umbrales
        self.RECOGNITION_THRESHOLD = 0.50
        self.MIN_CONFIDENCE = 0.50
        self.MARGIN_THRESHOLD = 0.08
        
        print(f"✅ Servicio inicializado (usando PostgreSQL)")
        print(f"   - Distancia máxima: {self.RECOGNITION_THRESHOLD}")
        print(f"   - Confianza mínima: {self.MIN_CONFIDENCE}")
        print(f"   - Margen de seguridad: {self.MARGIN_THRESHOLD}")


    # ============================================================
    # Cargar encodings desde base de datos
    # ============================================================
    def _load_user_encodings(self, user_id: Optional[int] = None) -> Tuple[List, List]:
        """
        Carga encodings desde la base de datos
        
        Args:
            user_id: Si se especifica, carga solo encodings de ese usuario
        
        Returns:
            Tupla de (encodings, user_ids)
        """
        query = self.db.query(models.FaceEncoding).filter(
            models.FaceEncoding.is_active == True
        )
        
        if user_id is not None:
            query = query.filter(models.FaceEncoding.user_id == user_id)
        
        face_encodings = query.all()
        
        encodings = []
        user_ids = []
        
        for fe in face_encodings:
            # Convertir de JSON array a numpy array
            encoding = np.array(fe.encoding_data, dtype=np.float64)
            encodings.append(encoding)
            user_ids.append(fe.user_id)
        
        return encodings, user_ids


    # ============================================================
    # Detectar rostro
    # ============================================================
    def _detect_face(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        with FaceRecognitionService._detector_lock:
            results = self.detector.process(rgb)

        if not results.detections:
            return None

        h, w, _ = frame.shape
        box = results.detections[0].location_data.relative_bounding_box

        x1 = int(box.xmin * w)
        y1 = int(box.ymin * h)
        x2 = int((box.xmin + box.width) * w)
        y2 = int((box.ymin + box.height) * h)

        expand = 40
        x1 = max(0, x1 - expand)
        y1 = max(0, y1 - expand)
        x2 = min(w, x2 + expand)
        y2 = min(h, y2 + expand)

        face = frame[y1:y2, x1:x2]

        if face.size == 0:
            return None

        return face


    # ============================================================
    # Registrar usuario (guardar en BD)
    # ============================================================
    def register(self, user_id: int, frame: np.ndarray, capture_method: str = "registration") -> Dict:
        """
        Registra un nuevo encoding facial en la base de datos
        
        Args:
            user_id: ID del usuario en la base de datos
            frame: Frame de la cámara
            capture_method: Método de captura (registration, improvement, verification)
        
        Returns:
            Dict con success, message y metadata
        """
        
        # Verificar que el usuario existe
        user = self.db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return {
                "success": False,
                "message": f"Usuario con ID {user_id} no existe en la base de datos"
            }
        
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

        # Verificar si el rostro ya está registrado para OTRO usuario
        all_encodings, all_user_ids = self._load_user_encodings()
        
        if all_encodings:
            distances = face_recognition.face_distance(all_encodings, encodings[0])
            min_dist_idx = int(np.argmin(distances))
            min_distance = float(distances[min_dist_idx])
            
            if min_distance < self.RECOGNITION_THRESHOLD:
                existing_user_id = all_user_ids[min_dist_idx]
                if existing_user_id != user_id:
                    existing_user = self.db.query(models.User).filter(
                        models.User.id == existing_user_id
                    ).first()
                    return {
                        "success": False,
                        "message": f"Este rostro ya está registrado para el usuario '{existing_user.full_name}'",
                        "quality_info": quality
                    }

        # Guardar encoding en base de datos
        face_encoding = models.FaceEncoding(
            user_id=user_id,
            encoding_data=encodings[0].tolist(),  # Convertir numpy array a lista
            encoding_version="1.0",
            quality_score=quality["score"],
            capture_method=capture_method,
            image_metadata={
                "brightness": float(quality["brightness"]),
                "sharpness": float(quality["sharpness"]),
                "contrast": float(quality["contrast"]),
                "size": quality["size"]
            }
        )
        
        self.db.add(face_encoding)
        self.db.commit()
        self.db.refresh(face_encoding)
        
        # Contar encodings del usuario
        total_encodings = self.db.query(models.FaceEncoding).filter(
            models.FaceEncoding.user_id == user_id,
            models.FaceEncoding.is_active == True
        ).count()

        print(f"✅ Encoding guardado en BD para usuario {user.full_name} (ID: {user_id})")

        return {
            "success": True,
            "message": f"Rostro registrado exitosamente ({total_encodings} muestras)",
            "encoding_id": face_encoding.id,
            "quality_info": quality,
            "total_encodings": total_encodings
        }


    # ============================================================
    # Reconocer usuario
    # ============================================================
    def recognize(self, frame: np.ndarray, require_quality_check: bool = True) -> Dict:
        if require_quality_check:
            quality = assess_image_quality(frame)
            if not quality["is_acceptable"]:
                return {"found": False, "user": None, "user_id": None, "confidence": 0, "message": "Calidad insuficiente", "quality_info": quality}

        # ✅ recorte rápido con MediaPipe
        face_img = self._detect_face(frame)
        if face_img is None:
            return {"found": False, "user": None, "user_id": None, "confidence": 0, "message": "No se detectó rostro"}

        # ✅ mismo pipeline del registro
        face_img = enhance_image(face_img)
        face_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        face_aligned = align_face(face_rgb)

        # ahora el encoding se hace sobre un recorte chico (más rápido y estable)
        locations = face_recognition.face_locations(face_aligned, model="hog")
        if not locations:
            return {"found": False, "user": None, "user_id": None, "confidence": 0, "message": "No se detectó rostro (recorte)"}

        encodings = face_recognition.face_encodings(face_aligned, locations)
        if not encodings:
            return {"found": False, "user": None, "user_id": None, "confidence": 0, "message": "No se pudo generar encoding"}

        encoding = encodings[0]

        # Cargar encodings de la base de datos
        all_encodings, all_user_ids = self._load_user_encodings()

        if not all_encodings:
            return {
                "found": True,
                "user": None,
                "user_id": None,
                "confidence": 0,
                "message": "No hay usuarios registrados"
            }

        # Calcular distancias
        distances = face_recognition.face_distance(all_encodings, encoding)
        
        # Obtener mejores matches
        sorted_indices = np.argsort(distances)
        best_idx = sorted_indices[0]
        best_distance = float(distances[best_idx])
        best_user_id = all_user_ids[best_idx]
        
        # Calcular confianza
        confidence = max(0.0, 1.0 - best_distance)
        
        # VALIDACIÓN 1: Verificar umbral de distancia
        if best_distance > self.RECOGNITION_THRESHOLD:
            print(f"❌ NO MATCH | dist={best_distance:.3f} > threshold={self.RECOGNITION_THRESHOLD}")
            return {
                "found": True,
                "user": None,
                "user_id": None,
                "confidence": confidence,
                "message": f"No hay coincidencia (distancia: {best_distance:.3f})"
            }
        
        # VALIDACIÓN 2: Verificar confianza mínima
        if confidence < self.MIN_CONFIDENCE:
            print(f"❌ NO MATCH | confianza={confidence:.3f} < mínima={self.MIN_CONFIDENCE}")
            return {
                "found": True,
                "user": None,
                "user_id": None,
                "confidence": confidence,
                "message": f"Confianza insuficiente ({confidence:.2%})"
            }
        
        # VALIDACIÓN 3: Margen de seguridad
        if len(sorted_indices) > 1:
            second_best_idx = sorted_indices[1]
            second_best_distance = float(distances[second_best_idx])
            second_best_user_id = all_user_ids[second_best_idx]
            
            if second_best_user_id != best_user_id:
                margin = second_best_distance - best_distance
                
                if margin < self.MARGIN_THRESHOLD:
                    print(f"⚠️ AMBIGUO | margin={margin:.3f} < threshold={self.MARGIN_THRESHOLD}")
                    return {
                        "found": True,
                        "user": None,
                        "user_id": None,
                        "confidence": confidence,
                        "message": "Reconocimiento ambiguo entre múltiples usuarios",
                        "ambiguous": True
                    }

        # ✅ MATCH EXITOSO - Obtener datos del usuario
        user = self.db.query(models.User).filter(models.User.id == best_user_id).first()
        
        if not user:
            return {
                "found": True,
                "user": None,
                "user_id": None,
                "confidence": confidence,
                "message": "Usuario encontrado pero no existe en BD"
            }
        
        print(f"✅ MATCH | user={user.full_name} (ID:{user.id}) | dist={best_distance:.3f} | conf={confidence:.3f}")
        
        return {
            "found": True,
            "user": user.full_name,
            "user_id": user.id,
            "confidence": confidence,
            "distance": best_distance,
            "message": "Usuario reconocido exitosamente"
        }


    # ============================================================
    # Agregar encoding adicional
    # ============================================================
    def add_encoding(self, user_id: int, frame: np.ndarray) -> Dict:
        """Agrega una muestra adicional a un usuario existente"""
        return self.register(user_id, frame, capture_method="improvement")


    # ============================================================
    # Eliminar encodings de usuario
    # ============================================================
    def remove_user_encodings(self, user_id: int) -> bool:
        """Marca como inactivos todos los encodings de un usuario (soft delete)"""
        try:
            self.db.query(models.FaceEncoding).filter(
                models.FaceEncoding.user_id == user_id
            ).update({"is_active": False})
            
            self.db.commit()
            print(f"✅ Encodings desactivados para usuario ID: {user_id}")
            return True
        except Exception as e:
            self.db.rollback()
            print(f"❌ Error desactivando encodings: {e}")
            return False


    # ============================================================
    # Estadísticas
    # ============================================================
    def get_stats(self) -> Dict:
        """Retorna estadísticas del sistema desde la base de datos"""
        
        # Total de usuarios con encodings
        total_users = self.db.query(models.FaceEncoding.user_id).filter(
            models.FaceEncoding.is_active == True
        ).distinct().count()
        
        # Total de encodings activos
        total_encodings = self.db.query(models.FaceEncoding).filter(
            models.FaceEncoding.is_active == True
        ).count()
        
        # Promedio por usuario
        avg_encodings = total_encodings / total_users if total_users > 0 else 0
        
        # Usuarios con encodings
        users_with_encodings = self.db.query(
            models.User.id, 
            models.User.full_name
        ).join(models.FaceEncoding).filter(
            models.FaceEncoding.is_active == True
        ).distinct().all()
        
        return {
            "total_users": total_users,
            "total_encodings": total_encodings,
            "avg_encodings_per_user": round(avg_encodings, 2),
            "users": [{"id": u.id, "name": u.full_name} for u in users_with_encodings],
            "config": {
                "recognition_threshold": self.RECOGNITION_THRESHOLD,
                "min_confidence": self.MIN_CONFIDENCE,
                "margin_threshold": self.MARGIN_THRESHOLD
            },
            "storage": "PostgreSQL Database"
        }