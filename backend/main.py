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
from backend.trends.trend_service import analyze_trends

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
    allow_methods=["GET", "POST", "DELETE"],  # ✅ Solo métodos necesarios
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
    # if request.client and hasattr(request.client, 'host'):
    #     client_ip = request.client.host
    #     if not check_rate_limit(client_ip, endpoint_type="monitoring"):
    #         raise HTTPException(
    #             status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    #             detail="Demasiadas peticiones de monitoreo. Espera un momento."
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
    """Listar todos los usuarios (solo admin)"""
    admin = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    users = db.query(models.User).filter(models.User.is_admin == False).all()
    
    return [{
        "id": u.id,
        "full_name": u.full_name,
        "age": u.age,
        "gender": u.gender,
        "email": u.email,
        "created_at": u.created_at,
        "total_assessments": len(u.assessments),
        "total_sessions": len(u.sessions)
    } for u in users]


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