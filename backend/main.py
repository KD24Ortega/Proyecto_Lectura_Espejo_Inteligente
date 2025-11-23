from fastapi import FastAPI, Depends, Request, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, validator, Field, EmailStr
from typing import List, Optional
import numpy as np
import cv2
from collections import defaultdict
from datetime import datetime, timedelta

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
# RATE LIMITING DIFERENCIADO
# -----------------------------
request_counts = defaultdict(list)

def check_rate_limit(client_ip: str, endpoint_type: str = "default"):
    """
    Limita peticiones por IP según el tipo de endpoint.
    
    endpoint_type:
    - "auth": Para login/registro (estricto: 10 req/min)
    - "monitoring": Para monitoreo de presencia (permisivo: 60 req/min)
    - "default": Para otros endpoints (medio: 30 req/min)
    """
    # Configuración según tipo
    limits = {
        "auth": {"max_requests": 10, "window_seconds": 60},
        "monitoring": {"max_requests": 60, "window_seconds": 60},
        "default": {"max_requests": 30, "window_seconds": 60}
    }
    
    config = limits.get(endpoint_type, limits["default"])
    max_requests = config["max_requests"]
    window_seconds = config["window_seconds"]
    
    # Crear clave única por IP y tipo de endpoint
    key = f"{client_ip}:{endpoint_type}"
    
    now = datetime.now()
    cutoff = now - timedelta(seconds=window_seconds)
    
    # Limpiar peticiones antiguas
    request_counts[key] = [
        req_time for req_time in request_counts[key]
        if req_time > cutoff
    ]
    
    # Agregar nueva petición
    request_counts[key].append(now)
    
    # Verificar límite
    if len(request_counts[key]) > max_requests:
        return False
    
    return True

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
# MODELOS CON VALIDACIÓN
# -----------------------------
class AssessmentRequest(BaseModel):
    user_id: int = Field(gt=0, description="ID del usuario debe ser mayor a 0")
    responses: List[int] = Field(min_length=7, max_length=9, description="Entre 7 y 9 respuestas")
    
    @validator('responses')
    def validate_responses(cls, v):
        # Validar que todas las respuestas estén entre 0 y 3
        if not all(0 <= r <= 3 for r in v):
            raise ValueError('Todas las respuestas deben estar entre 0 y 3')
        return v

class SessionStartRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100, description="Nombre de usuario")
    
    @validator('username')
    def validate_username(cls, v):
        # Remover espacios en blanco al inicio y final
        v = v.strip()
        if not v:
            raise ValueError('El nombre de usuario no puede estar vacío')
        return v

class UserRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    age: Optional[int] = Field(None, ge=1, le=120)  # Entre 1 y 120 años
    gender: Optional[str] = Field(None)
    email: Optional[EmailStr] = None  # EmailStr valida formato de email automáticamente
    
    @validator('full_name')
    def validate_full_name(cls, v):
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError('El nombre completo debe tener al menos 2 caracteres')
        return v
    
    @validator('gender')
    def validate_gender(cls, v):
        if v is None:
            return v
        allowed = ['m', 'f', 'otro', 'no_decir']
        if v not in allowed:
            raise ValueError(f'Género debe ser uno de: {", ".join(allowed)}')
        return v
    
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
async def register_face(
    full_name: str,
    age: Optional[int] = None,
    gender: Optional[str] = None,
    email: Optional[str] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Registra rostro + guarda usuario con datos completos en DB.
    """
    # Validaciones
    full_name = full_name.strip()
    if not full_name or len(full_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre completo debe tener al menos 2 caracteres"
        )
    
    if len(full_name) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre completo es demasiado largo (máximo 100 caracteres)"
        )
    
    # Validar edad
    if age is not None and (age < 1 or age > 120):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La edad debe estar entre 1 y 120 años"
        )
    
    # Validar género
    if gender is not None:
        allowed_genders = ['m', 'f', 'otro', 'no_decir']
        if gender not in allowed_genders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Género debe ser uno de: {', '.join(allowed_genders)}"
            )
    
    # Validar email
    if email:
        email = email.lower().strip()
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email inválido"
            )
        
        # Verificar si el email ya existe
        existing_email = db.query(models.User).filter(
            models.User.email == email
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este email ya está registrado"
            )
    
    # Validar tipo de archivo
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se aceptan imágenes JPEG o PNG"
        )
    
    # Leer y validar imagen
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen es demasiado grande (máximo 5MB)"
        )
    
    if len(contents) < 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen es demasiado pequeña"
        )
    
    npimg = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo procesar la imagen"
        )

    # Verificar si el usuario ya existe
    existing_user = db.query(models.User).filter(
        models.User.full_name.ilike(full_name)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El usuario '{full_name}' ya está registrado"
        )

    # Registrar encoding facial
    result = face_service.register(full_name, frame)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "No se pudo registrar el rostro")
        )

    # Crear usuario con todos los datos
    user = models.User(
        full_name=full_name,
        age=age,
        gender=gender,
        email=email
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    result["user_id"] = user.id
    result["full_name"] = user.full_name
    result["age"] = user.age
    result["gender"] = user.gender
    result["email"] = user.email

    return result

# ==============================================
# 📌 Reconocimiento facial SIN crear sesión (para chequeo de presencia)
# ==============================================
@app.post("/face/recognize/check")
async def recognize_face_check(request: Request, file: UploadFile = File(...)):
    """
    Reconoce el rostro pero NO crea sesión en DB.
    Usado para monitoreo continuo de presencia.
    """
    # Rate limiting PERMISIVO para monitoreo (60 req/min)
    if request.client and hasattr(request.client, 'host'):
        client_ip = request.client.host
        if not check_rate_limit(client_ip, endpoint_type="monitoring"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas peticiones de monitoreo. Espera un momento."
            )
    
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
async def recognize_face(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Reconocimiento facial con creación de sesión (para login).
    DEPRECADO: Usar /face/recognize/check y /session/start en su lugar.
    """
    # Rate limiting ESTRICTO para autenticación (10 req/min)
    if request.client and hasattr(request.client, 'host'):
        client_ip = request.client.host
        if not check_rate_limit(client_ip, endpoint_type="auth"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos de login. Espera un momento."
            )
    
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

    if not result["found"]:
        return result

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

    # 🔥 ASEGURARSE DE DEVOLVER user_id
    return {
        "found": True,
        "user": username,
        "user_id": user_id,  # 🔥 IMPORTANTE
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