from fastapi import FastAPI, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # 🔥 AGREGAR ESTO
from fastapi.responses import FileResponse   # 🔥 AGREGAR ESTO
from pydantic import BaseModel
from typing import List
import numpy as np
import cv2
from datetime import datetime

# -----------------------------
# IMPORTS DE TU PROYECTO
# -----------------------------
from backend.db.database import Base, engine, get_db
from backend.db import models
from sqlalchemy.orm import Session

from backend.assessments.phq_gad_service import (
    PHQ9_QUESTIONS, GAD7_QUESTIONS,
    phq9_score, gad7_score
)

from backend.recognition.face_service import FaceRecognitionService


# -----------------------------
# INICIALIZAR API Y BASE DE DATOS
# -----------------------------
app = FastAPI(title="Smart Mirror Backend")
Base.metadata.create_all(bind=engine)

# 🔥 SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# 🔥 RUTA RAÍZ - Servir login.html
@app.get("/")
async def root():
    return FileResponse("frontend/account/login.html")

# -----------------------------
# CORS - CONFIGURACIÓN SEGURA
# -----------------------------
# Lista de orígenes permitidos
ALLOWED_ORIGINS = [
    "http://localhost:8000",      # Servidor local FastAPI
    "http://127.0.0.1:8000",      # IP local
    "http://localhost:5500",      # Live Server (por si lo usas)
    "http://127.0.0.1:5500",
    # Agrega aquí tu dominio de producción cuando lo despliegues
    # "https://tudominio.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Solo orígenes específicos
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # ✅ Solo métodos necesarios
    allow_headers=["Content-Type", "Authorization"],  # ✅ Solo headers necesarios
    max_age=600,  # Cache de preflight requests por 10 minutos
)

# -----------------------------
# INICIALIZAR RECONOCIMIENTO FACIAL
# -----------------------------
face_service = FaceRecognitionService()

# -----------------------------
# MODELOS
# -----------------------------
class AssessmentRequest(BaseModel):
    user_id: int
    responses: List[int]

class SessionStartRequest(BaseModel):
    username: str


# ============================================================
#  SALUD
# ============================================================
@app.get("/health")
def health():
    return {"status": "ok"}


# ============================================================
#  REGISTRO FACIAL
# ============================================================
@app.post("/face/register")
async def register_face(username: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Registra rostro + guarda usuario en DB.
    """
    # Leer imagen
    contents = await file.read()
    npimg = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    if frame is None:
        return {"success": False, "message": "No se pudo procesar la imagen"}

    # Registrar encoding facial
    result = face_service.register(username, frame)

    if not result["success"]:
        return result

    # ======================
    # 🔹 Registrar usuario en BD
    # ======================
    user = models.User(full_name=username)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Devolver ID real del usuario recién creado
    result["user_id"] = user.id

    return result


# ==============================================
# 📌 Reconocimiento facial SIN crear sesión (para chequeo de presencia)
# ==============================================
@app.post("/face/recognize/check")
async def recognize_face_check(file: UploadFile = File(...)):
    """
    Reconoce el rostro pero NO crea sesión en DB.
    Usado para chequeo de presencia continua.
    """
    # Validar MIME
    if file.content_type not in ["image/jpeg", "image/png"]:
        return {"found": False, "user": None, "confidence": 0}

    # Leer bytes del archivo
    file_bytes = await file.read()

    if len(file_bytes) < 5000:
        return {"found": False, "user": None, "confidence": 0}

    # Convertir a NumPy
    np_img = cv2.imdecode(np.frombuffer(file_bytes, np.uint8), cv2.IMREAD_COLOR)

    if np_img is None:
        return {"found": False, "user": None, "confidence": 0}

    # Reconocimiento facial
    result = face_service.recognize(np_img)

    # No rostro
    if not result["found"]:
        return result

    # No reconocido
    if result["user"] is None:
        return {
            "found": True,
            "user": None,
            "confidence": result["confidence"]
        }

    # Usuario reconocido
    return {
        "found": True,
        "user": result["user"],
        "confidence": result["confidence"]
    }


# ==============================================
# 📌 MANEJO DE SESIONES
# ==============================================
@app.post("/session/start")
async def start_session(payload: SessionStartRequest, db: Session = Depends(get_db)):
    """
    Inicia una sesión de usuario (solo se llama una vez al hacer login).
    """
    username = payload.username

    # Buscar usuario en DB (case-insensitive)
    user_obj = db.query(models.User).filter(
        models.User.full_name.ilike(username)  # 🔥 CAMBIO: ilike en lugar de ==
    ).first()

    if not user_obj:
        return {"success": False, "error": "Usuario no encontrado"}

    # Crear sesión
    session = models.SessionLog(
        user_id=user_obj.id,
        username=user_obj.full_name,  # 🔥 Usar el nombre exacto de la DB
        method="face",
        is_active=True
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "success": True,
        "session_id": session.id,
        "user_id": user_obj.id,
        "username": user_obj.full_name
    }


@app.post("/session/end/{session_id}")
async def end_session(session_id: int, db: Session = Depends(get_db)):
    """
    Cierra una sesión de usuario.
    """
    session = db.query(models.SessionLog).filter(
        models.SessionLog.id == session_id
    ).first()

    if not session:
        return {"success": False, "error": "Sesión no encontrada"}

    # Marcar sesión como inactiva y registrar hora de cierre
    session.is_active = False  # type: ignore # ✅ Ahora sí podemos usar False
    session.timestamp_logout = datetime.utcnow() # type: ignore
    db.commit()

    return {
        "success": True,
        "message": "Sesión cerrada correctamente"
    }

# ==============================================
# 📌 Reconocimiento facial ANTIGUO (mantener por compatibilidad)
# ==============================================
@app.post("/face/recognize")
async def recognize_face(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    DEPRECADO: Usar /face/recognize/check y /session/start en su lugar.
    Este endpoint se mantiene por compatibilidad temporal.
    """
    # Validar MIME
    if file.content_type not in ["image/jpeg", "image/png"]:
        return {"found": False, "user": None, "confidence": 0}

    # Leer bytes del archivo
    file_bytes = await file.read()

    if len(file_bytes) < 5000:
        return {"found": False, "user": None, "confidence": 0}

    # Convertir a NumPy
    np_img = cv2.imdecode(np.frombuffer(file_bytes, np.uint8), cv2.IMREAD_COLOR)

    if np_img is None:
        return {"found": False, "user": None, "confidence": 0}

    # Reconocimiento facial
    result = face_service.recognize(np_img)

    # No rostro
    if not result["found"]:
        return result

    # No reconocido
    if result["user"] is None:
        return {
            "found": True,
            "user": None,
            "confidence": result["confidence"],
            "new_user": True
        }

    # Usuario reconocido
    username = result["user"]

    # Buscar usuario en DB
    user_obj = db.query(models.User).filter(
        models.User.full_name == username
    ).first()

    user_id = user_obj.id if user_obj else None

    # Registrar sesión
    session = models.SessionLog(
        user_id=user_id,
        username=username,
        method="face"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # 👉 "login_complete" EVITA EL BUCLE EN EL FRONTEND
    return {
        "found": True,
        "user": username,
        "confidence": result["confidence"],
        "session_id": session.id,
        "login_complete": True
    }

# ============================================================
#  PHQ-9
# ============================================================
@app.get("/phq9/questions")
def phq9_questions():
    return {"questions": PHQ9_QUESTIONS}


@app.post("/phq9/submit")
def phq9_submit(
    payload: AssessmentRequest,
    db: Session = Depends(get_db)
):

    result = phq9_score(payload.responses)

    assessment = models.Assessment(
        user_id=payload.user_id,
        type="phq9",
        score=result["score"],
        severity=result["severity"]
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return {"id": assessment.id, **result}


# ============================================================
#  GAD-7
# ============================================================
@app.get("/gad7/questions")
def gad7_questions():
    return {"questions": GAD7_QUESTIONS}


@app.post("/gad7/submit")
def gad7_submit(
    payload: AssessmentRequest,
    db: Session = Depends(get_db)
):

    result = gad7_score(payload.responses)

    assessment = models.Assessment(
        user_id=payload.user_id,
        type="gad7",
        score=result["score"],
        severity=result["severity"]
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return {"id": assessment.id, **result}

@app.post("/face/register/live")
def register_face_live(username: str, db: Session = Depends(get_db)):

    # Capturar frame desde cámara del servidor
    frame = face_service.read_frame()

    if frame is None:
        return {"success": False, "message": "No se pudo acceder a la cámara"}

    # Registrar encoding facial
    result = face_service.register(username, frame)

    # Si no se pudo registrar
    if not result["success"]:
        return result

    # Guardar usuario en la base de datos
    user = models.User(full_name=username)
    db.add(user)
    db.commit()
    db.refresh(user)

    result["user_id"] = user.id

    return result


@app.get("/dev/users")
def dev_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.get("/dev/sessions")
def dev_sessions(db: Session = Depends(get_db)):
    return db.query(models.SessionLog).all()

@app.get("/dev/assessments")
def dev_assessments(db: Session = Depends(get_db)):
    return db.query(models.Assessment).all()