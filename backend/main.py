from fastapi import FastAPI, Depends, Request, UploadFile, File, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, validator, Field, EmailStr
from typing import List, Optional
import numpy as np
import cv2
from collections import defaultdict
from datetime import datetime, timedelta
from backend.trends.trend_service import analyze_trends


# Importar el servicio de análisis de voz
try:
    from backend.services.voice_analysis_service import procesar_audio_archivo
except ImportError:
    from services.voice_analysis_service import procesar_audio_archivo

from backend.voice.transcription_service import TranscriptionService
from backend.voice.tts_service import TTSService

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
from backend.auth import hash_password, verify_password, create_access_token, decode_access_token
from backend.db.init_admin import init_super_admin

from backend.webrtc.webrtc_service import (
    handle_webrtc_offer,
    presence_state
)

# -----------------------------
# SERVICIO EMAIL
# -----------------------------
import resend

resend.api_key = "re_361pUwcN_LsC1uhDKeUm9QiJqd4HnmENE"

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

# 🔥 INICIALIZAR SUPER ADMINISTRADOR AUTOMÁTICAMENTE
init_super_admin()

# 🔥 SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND
#app.mount("/static", StaticFiles(directory="frontend"), name="static")

# 🔥 RUTA RAÍZ - Servir login.html
@app.get("/")
async def root():
    return {
        "message": "Smart Mirror API",
        "version": "2.0",
        "frontend": "React app running on http://localhost:5173",
        "docs": "http://127.0.0.1:8000/docs"
    }
# -----------------------------
# CORS - CONFIGURACIÓN SEGURA
# -----------------------------
# Lista de orígenes permitidos
ALLOWED_ORIGINS = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5173",      # ← React (Vite)
    "http://127.0.0.1:5173",      # ← React (Vite)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Solo orígenes específicos
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],  # ✅ Solo métodos necesarios
    allow_headers=["Content-Type", "Authorization"],  # ✅ Solo headers necesarios
    max_age=600,  # Cache de preflight requests por 10 minutos
)

# -----------------------------
# INICIALIZAR RECONOCIMIENTO FACIAL
# -----------------------------
face_service = FaceRecognitionService()

try:
    transcription_service = TranscriptionService()
    tts_service = TTSService()
except Exception as e:
    print(f"⚠️ No se pudo inicializar servicios de voz: {e}")
    transcription_service = None
    tts_service = None

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


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    
    @validator('username')
    def validate_username(cls, v):
        v = v.strip().lower()
        if not v:
            raise ValueError('El nombre de usuario no puede estar vacío')
        return v

class AdminChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=6, max_length=100)
    new_password: str = Field(min_length=6, max_length=100)
    
    @validator('new_password')  # ← Mantén solo este
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('La nueva contraseña debe tener al menos 8 caracteres')
        return v
    
# ============================================================
#  SALUD
# ============================================================
@app.get("/health")
def health():
    return {"status": "ok"}

# ============================================================
#  LOGIN ADMINISTRADOR
# ============================================================
@app.post("/admin/login")
async def admin_login(credentials: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    Login de administrador con usuario y contraseña
    """
    # Buscar admin por username
    admin = db.query(models.User).filter(
        models.User.username == credentials.username,
        models.User.is_admin == True
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )
    
    # Verificar contraseña
    if not verify_password(credentials.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )
    
    # Crear token JWT
    access_token = create_access_token(
        data={
            "user_id": admin.id,
            "username": admin.username,
            "is_admin": True
        }
    )
    
    # Crear sesión
    session = models.SessionLog(
        user_id=admin.id,
        username=admin.username,
        method="password",
        is_active=True
    )
    db.add(session)
    db.commit()
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": admin.id,
            "username": admin.username,
            "full_name": admin.full_name,
            "is_admin": True
        }
    }


@app.post("/admin/change-password")
async def admin_change_password(
    request: AdminChangePasswordRequest,
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Cambiar contraseña del administrador
    """
    # Buscar admin
    admin = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.is_admin == True
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado"
        )
    
    # Verificar contraseña actual
    if not verify_password(request.old_password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta"
        )
    
    # Actualizar contraseña
    admin.password_hash = hash_password(request.new_password)
    admin.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña actualizada correctamente"
    }



# ============================================================
#  REGISTRO FACIAL
# ============================================================
@app.post("/face/register")
async def register_face(
    file: UploadFile = File(...),
    full_name: str = Form(...),
    age: Optional[int] = Form(None),
    gender: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Registra rostro + guarda usuario con datos completos en DB.
    """
    from fastapi import Form  # ← Asegúrate de tener este import al inicio
    
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

# ============================================================
#  REGISTRO DE USUARIO (SOLO DATOS)
# ============================================================
@app.post("/users/register")
async def register_user(user: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en la base de datos (sin rostro)
    El rostro se registra después con /face/register
    """
    try:
        # Verificar si el email ya existe (si se proporciona)
        if user.email:
            existing_user = db.query(models.User).filter(
                models.User.email == user.email
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="El email ya está registrado"
                )
        
        # Verificar si el nombre ya existe
        existing_name = db.query(models.User).filter(
            models.User.full_name.ilike(user.full_name)
        ).first()
        if existing_name:
            raise HTTPException(
                status_code=409,
                detail=f"El usuario '{user.full_name}' ya está registrado"
            )
        
        # Generar username único basado en el nombre
        base_username = user.full_name.lower().replace(" ", "_")
        username = base_username
        counter = 1
        
        # Verificar que el username sea único
        while db.query(models.User).filter(models.User.username == username).first():
            username = f"{base_username}_{counter}"
            counter += 1
        
        # Crear usuario
        new_user = models.User(
            full_name=user.full_name,
            username=username,
            age=user.age,
            gender=user.gender,
            email=user.email,
            is_admin=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "success": True,
            "message": "Usuario registrado exitosamente",
            "user_id": new_user.id,
            "username": new_user.username,
            "full_name": new_user.full_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al registrar usuario: {str(e)}"
        )

# ==============================================
# 📌 Reconocimiento facial SIN crear sesión (para chequeo de presencia)
# ==============================================
@app.post("/face/recognize/check")
async def recognize_face_check(request: Request, file: UploadFile = File(...)):
    """
    Proxy al reconocimiento ANTIGUO que sí funciona.
    """
    # Validar MIME
    if not file.content_type or not file.content_type.startswith("image/"):
        return {"found": False, "user": None, "confidence": 0}

    file_bytes = await file.read()
    if len(file_bytes) < 5000:
        return {"found": False, "user": None, "confidence": 0}

    np_img = cv2.imdecode(np.frombuffer(file_bytes, np.uint8), cv2.IMREAD_COLOR)

    if np_img is None:
        return {"found": False, "user": None, "confidence": 0}

    # 🔥 USAR directamente el método ANTIGUO
    result = face_service.recognize(np_img)

    return result
    

# ==============================================
# 📌 MANEJO DE SESIONES
# ==============================================
@app.post("/session/start")
async def start_session(payload: SessionStartRequest, db: Session = Depends(get_db)):
    username = payload.username

    # Buscar usuario
    user_obj = db.query(models.User).filter(
        models.User.full_name.ilike(username)
    ).first()

    if not user_obj:
        return {"success": False, "error": "Usuario no encontrado"}

    # 🔥 CERRAR TODAS LAS SESIONES ACTIVAS PREVIAS
    db.query(models.SessionLog).filter(
        models.SessionLog.user_id == user_obj.id,
        models.SessionLog.is_active == True
    ).update({
        models.SessionLog.is_active: False,
        models.SessionLog.timestamp_logout: datetime.utcnow()
    })
    db.commit()

    # 🔥 CREAR NUEVA SESIÓN
    session = models.SessionLog(
        user_id=user_obj.id,
        username=user_obj.full_name,
        method="face",
        is_active=True,
        timestamp_login=datetime.utcnow()
    )
    db.add(session)
    db.commit()

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
    # if request.client and hasattr(request.client, 'host'):
    #     client_ip = request.client.host
    #     if not check_rate_limit(client_ip, endpoint_type="auth"):
    #         raise HTTPException(
    #             status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    #             detail="Demasiados intentos de login. Espera un momento."
    #         )
    
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

# ============================================================
# ENDPOINTS DE SUPER ADMINISTRADOR
# ============================================================

@app.get("/admin/dashboard")
async def admin_dashboard(user_id: int, db: Session = Depends(get_db)):
    """Panel de administrador - verificar autenticación"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    total_users = db.query(models.User).filter(models.User.is_admin == False).count()
    
    # Solo sesiones de usuarios normales (método facial)
    total_sessions = db.query(models.SessionLog).filter(
        models.SessionLog.method == "face"
    ).count()
    
    # Solo evaluaciones de usuarios no-admin
    total_assessments = db.query(models.Assessment).join(models.User).filter(
        models.User.is_admin == False
    ).count()
    
    # Solo sesiones activas de usuarios normales
    active_sessions = db.query(models.SessionLog).filter(
        models.SessionLog.is_active == True,
        models.SessionLog.method == "face"
    ).count()
    
    return {
        "total_users": total_users,
        "total_sessions": total_sessions,
        "total_assessments": total_assessments,
        "active_sessions": active_sessions
    }


@app.get("/admin/users")
async def admin_get_all_users(user_id: int, db: Session = Depends(get_db)):
    """Listar todos los usuarios con sus últimos PHQ-9 y GAD-7 (solo admin)"""
    
    admin = db.query(models.User).filter(models.User.id == user_id).first()

    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    users = db.query(models.User).filter(models.User.is_admin == False).all()

    response = []

    for u in users:

        # -----------------------------
        # 🔥 Obtener último PHQ-9
        # -----------------------------
        last_phq9 = (
            db.query(models.Assessment)
            .filter(
                models.Assessment.user_id == u.id,
                models.Assessment.type == "phq9"
            )
            .order_by(models.Assessment.created_at.desc())
            .first()
        )

        if last_phq9:
            latest_phq9 = last_phq9.score
            latest_phq9_severity = last_phq9.severity
            latest_phq9_date = last_phq9.created_at.isoformat()
        else:
            latest_phq9 = None
            latest_phq9_severity = None
            latest_phq9_date = None

        # -----------------------------
        # 🔥 Obtener último GAD-7
        # -----------------------------
        last_gad7 = (
            db.query(models.Assessment)
            .filter(
                models.Assessment.user_id == u.id,
                models.Assessment.type == "gad7"
            )
            .order_by(models.Assessment.created_at.desc())
            .first()
        )

        if last_gad7:
            latest_gad7 = last_gad7.score
            latest_gad7_severity = last_gad7.severity
            latest_gad7_date = last_gad7.created_at.isoformat()
        else:
            latest_gad7 = None
            latest_gad7_severity = None
            latest_gad7_date = None

        # -----------------------------
        # 🔥 Construir respuesta del usuario
        # -----------------------------
        response.append({
            "id": u.id,
            "full_name": u.full_name,
            "age": u.age,
            "gender": u.gender,
            "email": u.email,
            "created_at": u.created_at,
            "total_assessments": len(u.assessments),
            "total_sessions": len(u.sessions),

            # Últimos resultados
            "latest_phq9": latest_phq9,
            "latest_phq9_severity": latest_phq9_severity,
            "latest_phq9_date": latest_phq9_date,

            "latest_gad7": latest_gad7,
            "latest_gad7_severity": latest_gad7_severity,
            "latest_gad7_date": latest_gad7_date
        })

    return response


@app.get("/admin/user/{target_user_id}")
async def admin_get_user_details(target_user_id: int, user_id: int, db: Session = Depends(get_db)):
    """Ver detalles completos de un usuario"""
    admin = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    user = db.query(models.User).filter(models.User.id == target_user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "age": user.age,
            "gender": user.gender,
            "email": user.email,
            "created_at": user.created_at
        },
        "assessments": [{
            "id": a.id,
            "type": a.type,
            "score": a.score,
            "severity": a.severity,
            "created_at": a.created_at
        } for a in user.assessments],
        "sessions": [{
            "id": s.id,
            "login": s.timestamp_login,
            "logout": s.timestamp_logout,
            "is_active": s.is_active
        } for s in user.sessions],
        "voice_analyses": [{
            "id": v.id,
            "risk_level": v.risk_level,
            "created_at": v.created_at
        } for v in user.voice_analyses] if hasattr(user, 'voice_analyses') else [],
        "smartwatch_data": [{
            "id": s.id,
            "hrv": s.hrv_rmssd,
            "steps": s.steps,
            "sleep": s.sleep_minutes,
            "recorded_at": s.recorded_at
        } for s in user.smartwatch_data] if hasattr(user, 'smartwatch_data') else [],
        "trends": [{
            "id": t.id,
            "multimodal_score": t.multimodal_score,
            "status": t.status,
            "created_at": t.created_at
        } for t in user.trends] if hasattr(user, 'trends') else []
    }


@app.delete("/admin/user/{target_user_id}")
async def admin_delete_user(target_user_id: int, user_id: int, db: Session = Depends(get_db)):
    """Eliminar usuario (solo admin)"""
    admin = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    user = db.query(models.User).filter(models.User.id == target_user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.is_admin:
        raise HTTPException(status_code=403, detail="No se puede eliminar a un administrador")
    
    # 🔥 ELIMINAR ENCODING FACIAL
    try:
        face_service.remove_encoding(user.full_name)
    except Exception as e:
        print(f"⚠️ No se pudo eliminar encoding: {e}")
    
    db.delete(user)
    db.commit()
    
    return {"success": True, "message": f"Usuario {user.full_name} eliminado"}
# Agregar después del último endpoint
@app.get("/trends/analyze/{user_id}")
async def get_user_trends(user_id: int, days: int = 30, db: Session = Depends(get_db)):
    """Analizar tendencias de un usuario"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    trends = analyze_trends(db, user_id, days)
    return trends


@app.get("/trends/history/{user_id}")
async def get_trends_history(user_id: int, db: Session = Depends(get_db)):
    """Obtener historial de análisis de tendencias"""
    trends = db.query(models.TrendAnalysis).filter(
        models.TrendAnalysis.user_id == user_id
    ).order_by(models.TrendAnalysis.created_at.desc()).limit(10).all()
    
    return [{
        "id": t.id,
        "phq9_trend": t.phq9_trend,
        "gad7_trend": t.gad7_trend,
        "multimodal_score": t.multimodal_score,
        "status": t.status,
        "created_at": t.created_at
    } for t in trends]
    
    
# Agregar endpoints al final del archivo

@app.post("/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribir audio a texto"""
    
    if not transcription_service:
        raise HTTPException(status_code=500, detail="Servicio de transcripción no disponible")
    
    audio_bytes = await file.read()
    result = transcription_service.transcribe(audio_bytes)
    
    return result


@app.post("/voice/map-response")
async def map_voice_response(text: str):
    """Mapear respuesta de voz a puntuación 0-3"""
    
    if not transcription_service:
        raise HTTPException(status_code=500, detail="Servicio no disponible")
    
    score = transcription_service.map_response_to_score(text)
    
    return {"text": text, "score": score}


@app.get("/voice/speak/{question_text}")
async def speak_question(question_text: str):
    if not tts_service:
        raise HTTPException(status_code=500, detail="Servicio TTS no disponible")
    
    audio_bytes = tts_service.generate_audio_bytes(question_text)
    
    from fastapi.responses import Response
    return Response(content=audio_bytes, media_type="audio/mpeg")

# ============================================================
# ENDPOINT PARA OBTENER USER_ID POR NOMBRE
# ============================================================
@app.get("/user/id-by-name")
async def get_user_id_by_name(name: str, db: Session = Depends(get_db)):
    """Obtener user_id buscando por nombre"""
    user = db.query(models.User).filter(
        models.User.full_name.ilike(f"%{name}%")
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email
    }


# ============================================================
# ENDPOINT PARA OBTENER ÚLTIMOS SCORES DE USUARIO
# ============================================================
@app.get("/assessments/last/{user_id}")
async def get_last_assessments(user_id: int, db: Session = Depends(get_db)):
    """Obtener últimos scores PHQ-9 y GAD-7 de un usuario"""
    
    # Último PHQ-9
    last_phq9 = db.query(models.Assessment).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.type == "phq9"
    ).order_by(models.Assessment.created_at.desc()).first()
    
    # Último GAD-7
    last_gad7 = db.query(models.Assessment).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.type == "gad7"
    ).order_by(models.Assessment.created_at.desc()).first()
    
    return {
        "phq9": {
            "score": last_phq9.score if last_phq9 else None,
            "severity": last_phq9.severity if last_phq9 else None,
            "timestamp": last_phq9.created_at.isoformat() if last_phq9 else None
        },
        "gad7": {
            "score": last_gad7.score if last_gad7 else None,
            "severity": last_gad7.severity if last_gad7 else None,
            "timestamp": last_gad7.created_at.isoformat() if last_gad7 else None
        }
    }

from fastapi import Body

# ==============================================
# 📡 WebRTC: recibir OFFER y devolver ANSWER
# ==============================================
@app.post("/webrtc/offer")
async def webrtc_offer(
    data: dict = Body(...)
):
    """
    Recibe la SDP offer desde el frontend y devuelve la SDP answer.
    """
    client_id = data.get("client_id")
    offer_sdp = data.get("sdp")
    offer_type = data.get("type")

    if not client_id or not offer_sdp or not offer_type:
        raise HTTPException(status_code=400, detail="Faltan campos en la oferta WebRTC")

    answer = await handle_webrtc_offer(offer_sdp, offer_type, client_id)
    return answer


# ==============================================
# 📊 Endpoint para consultar presencia por client_id
# ==============================================
@app.get("/presence/{client_id}")
async def get_presence(client_id: str):
    """
    Devuelve el último estado de presencia para un client_id.
    """
    state = presence_state.get(client_id)

    if not state:
        return {
            "found": False,
            "user": None,
            "confidence": 0.0,
            "last_update": None
        }

    # Serializar datetime a string
    last_update = state.get("last_update")
    if last_update is not None:
        last_update = last_update.isoformat()

    return {
        "found": state.get("found", False),
        "user": state.get("user"),
        "confidence": state.get("confidence", 0.0),
        "last_update": last_update,
        "error": state.get("error")  # opcional
    }


# ============================================================
#  ENVÍO DE NOTIFICACIONES POR EMAIL
# ============================================================

class EmailRequest(BaseModel):
    user_id: int
    message: str


@app.post("/notifications/email")
async def send_notification_email(
    payload: EmailRequest,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()

    if not user or not user.email:
        raise HTTPException(status_code=404, detail="Usuario sin email registrado")

    # Convertimos saltos de línea antes de usar f-string
    html_message = payload.message.replace("\n", "<br>")

    try:
        resend.Emails.send({
            "from": "Smart Mirror <onboarding@resend.dev>",
            "to": [user.email],
            "subject": "Seguimiento Clínico - Smart Mirror",
            "html": f"""
                <h3>Notificación Smart Mirror</h3>
                <p>{html_message}</p>
            """
        })

        return { "success": True, "email": user.email }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



#============================================================
#  ESTADÍSTICAS DIARIAS PARA DASHBOARD ADMIN
#============================================================

@app.get("/admin/stats/history")
async def admin_stats_history(
    user_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Estadísticas reales diarias para el dashboard.
    """
    # Validar admin
    admin = db.query(models.User).filter(models.User.id == user_id).first()
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    today = datetime.utcnow().date()
    start_date = today - timedelta(days=days - 1)

    # =============== USUARIOS NUEVOS ===============
    new_users = db.query(models.User).filter(
        models.User.created_at >= start_date,
        models.User.is_admin == False
    ).all()

    users_by_day = {}
    for u in new_users:
        day = u.created_at.date()
        users_by_day[day] = users_by_day.get(day, 0) + 1

    # =============== ASSESSMENTS ===============
    assessments = db.query(models.Assessment).join(models.User).filter(
        models.Assessment.created_at >= start_date,
        models.User.is_admin == False
    ).all()

    assessments_by_day = {}
    alerts_by_day = {}

    for a in assessments:
        day = a.created_at.date()

        # Conteo general
        assessments_by_day[day] = assessments_by_day.get(day, 0) + 1
        
        # Alertas críticas → PHQ9>=15 o GAD7>=15
        if a.score >= 15:
            alerts_by_day[day] = alerts_by_day.get(day, 0) + 1

    # Construir datos día por día
    history = []

    for i in range(days):
        day = start_date + timedelta(days=i)
        history.append({
            "date": day.isoformat(),
            "users": users_by_day.get(day, 0),
            "assessments": assessments_by_day.get(day, 0),
            "alerts": alerts_by_day.get(day, 0)
        })

    return {"days": days, "history": history}


# ============================================================
# ENDPOINT BACKEND: Marcar Usuario como Atendido
# ============================================================
# Agregar esto a main.py en la sección de endpoints de admin

from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional

# ============================================================
# MODELO DE DATOS
# ============================================================

class MarkAttendedRequest(BaseModel):
    admin_id: int
    notes: Optional[str] = None
    schedule_followup: bool = False
    followup_date: Optional[str] = None
    send_confirmation: bool = False


# ============================================================
# ENDPOINT
# ============================================================

@app.post("/admin/mark-attended/{user_id}")
async def mark_user_attended(
    user_id: int,
    payload: MarkAttendedRequest,
    db: Session = Depends(get_db)
):
    """
    Marca un usuario como atendido y registra la sesión.
    
    Funcionalidades:
    - Registra atención con fecha/hora y notas
    - Opcional: programa seguimiento
    - Opcional: envía email de confirmación
    - Actualiza flag de "requiere atención"
    """
    
    # Validar que el admin existe
    admin = db.query(models.User).filter(
        models.User.id == payload.admin_id,
        models.User.is_admin == True
    ).first()
    
    if not admin:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Validar que el usuario existe
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Crear registro de atención
    attendance = models.AttendanceRecord(
        user_id=user_id,
        admin_id=payload.admin_id,
        notes=payload.notes,
        attended_at=datetime.utcnow()
    )
    db.add(attendance)
    
    # Programar seguimiento si se solicitó
    if payload.schedule_followup and payload.followup_date:
        try:
            followup_datetime = datetime.fromisoformat(payload.followup_date)
            followup = models.FollowUp(
                user_id=user_id,
                scheduled_for=followup_datetime,
                status="pending",
                created_by=payload.admin_id
            )
            db.add(followup)
        except ValueError:
            pass  # Si la fecha es inválida, simplemente no programar
    
    # Actualizar flag de requiere atención (si existe en tu modelo)
    # user.requires_attention = False
    
    # Enviar email de confirmación si se solicitó
    if payload.send_confirmation and user.email:
        try:
            # Usar tu sistema de emails (Resend o similar)
            email_message = f"""
            <h2>Confirmación de Atención - Smart Mirror</h2>
            <p>Estimado/a {user.full_name},</p>
            <p>Te confirmamos que tu sesión ha sido registrada exitosamente.</p>
            <p>Fecha: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}</p>
            {f'<p>Próximo seguimiento programado: {payload.followup_date}</p>' if payload.schedule_followup else ''}
            <p>Si tienes alguna duda, no dudes en contactarnos.</p>
            <p>Saludos,<br>Equipo Smart Mirror</p>
            """
            
            # Ejemplo con Resend (ajusta según tu implementación)
            # resend.Emails.send({
            #     "from": "Smart Mirror <onboarding@resend.dev>",
            #     "to": [user.email],
            #     "subject": "Confirmación de Atención - Smart Mirror",
            #     "html": email_message
            # })
            
            # Por ahora, solo log
            print(f"Email de confirmación enviado a {user.email}")
        except Exception as e:
            print(f"Error enviando email: {e}")
            # No fallar la operación si el email falla
    
    db.commit()
    
    return {
        "success": True,
        "message": "Usuario marcado como atendido exitosamente",
        "attendance_id": attendance.id if hasattr(attendance, 'id') else None,
        "followup_scheduled": payload.schedule_followup,
        "confirmation_sent": payload.send_confirmation and user.email is not None
    }

# =====================================================
#  ENDPOINTS DE EJERCICIOS DE VOZ
#  Agregar a main.py (solo endpoints, sin imports de modelos)
# =====================================================




# =====================
# ENDPOINTS: EJERCICIOS
# =====================

@app.get("/api/exercises")
async def get_exercises(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Obtiene el catálogo de ejercicios.
    
    Query params:
    - category: "anxiety", "depression" o "both" (opcional)
    """
    query = db.query(models.Exercise)
    
    if category:
        query = query.filter(
            (models.Exercise.category == category) | 
            (models.Exercise.category == "both")
        )
    
    exercises = query.all()
    
    return [
        {
            "id": ex.id,
            "title": ex.title,
            "description": ex.description,
            "category": ex.category.value if hasattr(ex.category, 'value') else ex.category,
            "exercise_type": ex.exercise_type.value if hasattr(ex.exercise_type, 'value') else ex.exercise_type,
            "duration_seconds": ex.duration_seconds,
            "instructions": ex.instructions,
            "audio_guide_url": ex.audio_guide_url
        }
        for ex in exercises
    ]


@app.get("/api/exercises/{exercise_id}")
async def get_exercise(
    exercise_id: int,
    db: Session = Depends(get_db)
):
    """Obtiene un ejercicio específico por ID"""
    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == exercise_id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    
    return {
        "id": exercise.id,
        "title": exercise.title,
        "description": exercise.description,
        "category": exercise.category.value if hasattr(exercise.category, 'value') else exercise.category,
        "exercise_type": exercise.exercise_type.value if hasattr(exercise.exercise_type, 'value') else exercise.exercise_type,
        "duration_seconds": exercise.duration_seconds,
        "instructions": exercise.instructions,
        "audio_guide_url": exercise.audio_guide_url
    }


# =====================
# ENDPOINTS: ANÁLISIS DE VOZ
# =====================

@app.post("/api/voice/analyze")
async def analyze_voice(
    audio_file: UploadFile = File(...),
    gender: str = Form("neutro")
):
    """
    Analiza un archivo de audio y retorna biomarcadores vocales.
    
    Form params:
    - audio_file: Archivo de audio (wav, mp3, etc.)
    - gender: "masculino", "femenino" o "neutro"
    """
    try:
        audio_bytes = await audio_file.read()
        resultado = procesar_audio_archivo(audio_bytes, gender)
        return resultado
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analizando audio: {str(e)}"
        )


# =====================
# ENDPOINTS: SESIONES DE EJERCICIOS
# =====================

@app.post("/api/voice/sessions")
async def create_voice_session(
    audio_file: UploadFile = File(...),
    user_id: int = Form(...),
    exercise_id: int = Form(...),
    duration_seconds: int = Form(...),
    gender: str = Form("neutro"),
    completed: bool = Form(True),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Crea una sesión de ejercicio de voz con análisis completo.
    
    Form params:
    - audio_file: Archivo de audio grabado durante el ejercicio
    - user_id: ID del usuario
    - exercise_id: ID del ejercicio realizado
    - duration_seconds: Duración de la sesión
    - gender: Género del usuario para ajustar umbrales
    - completed: Si completó el ejercicio
    - notes: Notas adicionales (opcional)
    """
    try:
        # Validar usuario
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Validar ejercicio
        exercise = db.query(models.Exercise).filter(
            models.Exercise.id == exercise_id
        ).first()
        if not exercise:
            raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
        
        # Leer y analizar audio
        audio_bytes = await audio_file.read()
        analisis = procesar_audio_archivo(audio_bytes, gender)
        
        # Crear sesión en BD
        session = models.VoiceExerciseSession(
            user_id=user_id,
            exercise_id=exercise_id,
            pitch_mean=analisis["pitch_mean"],
            pitch_std=analisis["pitch_std"],
            energy=analisis["energy"],
            voice_ratio=analisis["voice_ratio"],
            mfcc_variability=analisis["mfcc_variability"],
            jitter=analisis["jitter"],
            shimmer=analisis["shimmer"],
            hnr=analisis["hnr"],
            score=analisis["score"],
            risk_level=analisis["risk_level"],
            duration_seconds=duration_seconds,
            completed=completed,
            notes=notes
        )
        
        db.add(session)
        db.commit()
        db.refresh(session)
        
        return {
            "id": session.id,
            "user_id": session.user_id,
            "exercise_id": session.exercise_id,
            "pitch_mean": session.pitch_mean,
            "pitch_std": session.pitch_std,
            "energy": session.energy,
            "voice_ratio": session.voice_ratio,
            "mfcc_variability": session.mfcc_variability,
            "jitter": session.jitter,
            "shimmer": session.shimmer,
            "hnr": session.hnr,
            "score": session.score,
            "risk_level": session.risk_level.value if hasattr(session.risk_level, 'value') else session.risk_level,
            "duration_seconds": session.duration_seconds,
            "completed": session.completed,
            "created_at": session.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error creando sesión: {str(e)}"
        )


@app.get("/api/voice/sessions/user/{user_id}")
async def get_user_voice_sessions(
    user_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Obtiene el historial de sesiones de voz de un usuario.
    
    Query params:
    - limit: Número máximo de sesiones a retornar (default: 50)
    """
    sessions = db.query(models.VoiceExerciseSession).filter(
        models.VoiceExerciseSession.user_id == user_id
    ).order_by(
        models.VoiceExerciseSession.created_at.desc()
    ).limit(limit).all()
    
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "exercise_id": s.exercise_id,
            "pitch_mean": s.pitch_mean,
            "pitch_std": s.pitch_std,
            "energy": s.energy,
            "voice_ratio": s.voice_ratio,
            "mfcc_variability": s.mfcc_variability,
            "jitter": s.jitter,
            "shimmer": s.shimmer,
            "hnr": s.hnr,
            "score": s.score,
            "risk_level": s.risk_level.value if hasattr(s.risk_level, 'value') else s.risk_level,
            "duration_seconds": s.duration_seconds,
            "completed": s.completed,
            "created_at": s.created_at.isoformat()
        }
        for s in sessions
    ]


@app.get("/api/voice/sessions/{session_id}")
async def get_voice_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """Obtiene una sesión específica por ID"""
    session = db.query(models.VoiceExerciseSession).filter(
        models.VoiceExerciseSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    return {
        "id": session.id,
        "user_id": session.user_id,
        "exercise_id": session.exercise_id,
        "pitch_mean": session.pitch_mean,
        "pitch_std": session.pitch_std,
        "energy": session.energy,
        "voice_ratio": session.voice_ratio,
        "mfcc_variability": session.mfcc_variability,
        "jitter": session.jitter,
        "shimmer": session.shimmer,
        "hnr": session.hnr,
        "score": session.score,
        "risk_level": session.risk_level.value if hasattr(session.risk_level, 'value') else session.risk_level,
        "duration_seconds": session.duration_seconds,
        "completed": session.completed,
        "created_at": session.created_at.isoformat()
    }


# =====================
# ENDPOINT: RECOMENDACIONES BASADAS EN TESTS
# =====================

@app.get("/api/voice/recommendations/{user_id}")
async def get_exercise_recommendations(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene recomendaciones de ejercicios basadas en los últimos tests del usuario.
    
    Lógica:
    - PHQ-9 alto → Ejercicios para depresión
    - GAD-7 alto → Ejercicios para ansiedad
    - Ambos altos → Ejercicios para ambos
    """
    # Obtener últimas evaluaciones
    last_phq9 = db.query(models.Assessment).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.type == "phq9"
    ).order_by(models.Assessment.created_at.desc()).first()
    
    last_gad7 = db.query(models.Assessment).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.type == "gad7"
    ).order_by(models.Assessment.created_at.desc()).first()
    
    if not last_phq9 and not last_gad7:
        raise HTTPException(
            status_code=404,
            detail="Usuario no tiene evaluaciones registradas"
        )
    
    # Determinar categoría recomendada
    phq9_score = last_phq9.score if last_phq9 else 0
    gad7_score = last_gad7.score if last_gad7 else 0
    
    if phq9_score >= 10 and gad7_score >= 10:
        category = "both"
        message = "Ejercicios recomendados para ansiedad y depresión"
    elif gad7_score >= 10:
        category = "anxiety"
        message = "Ejercicios recomendados para ansiedad"
    elif phq9_score >= 10:
        category = "depression"
        message = "Ejercicios recomendados para depresión"
    else:
        category = "both"
        message = "Ejercicios de mantenimiento y bienestar general"
    
    # Obtener ejercicios recomendados
    exercises = db.query(models.Exercise).filter(
        (models.Exercise.category == category) | 
        (models.Exercise.category == "both")
    ).limit(6).all()
    
    return {
        "user_id": user_id,
        "phq9_score": phq9_score,
        "gad7_score": gad7_score,
        "recommended_category": category,
        "message": message,
        "exercises": [
            {
                "id": ex.id,
                "title": ex.title,
                "description": ex.description,
                "category": ex.category.value if hasattr(ex.category, 'value') else ex.category,
                "exercise_type": ex.exercise_type.value if hasattr(ex.exercise_type, 'value') else ex.exercise_type,
                "duration_seconds": ex.duration_seconds,
                "instructions": ex.instructions,
                "audio_guide_url": ex.audio_guide_url
            }
            for ex in exercises
        ]
    }