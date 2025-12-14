#!/usr/bin/env python3
"""
Endpoint para cerrar sesión correctamente
Agregar a main.py o crear archivo separado session_routes.py
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from backend.db.database import get_db
from backend.db import models

router = APIRouter(prefix="/session", tags=["sessions"])


# ============================================================
# SCHEMAS
# ============================================================
class SessionStartRequest(BaseModel):
    user_id: int
    username: str


class SessionEndRequest(BaseModel):
    user_id: int


# ============================================================
# INICIAR SESIÓN (ya existe, pero incluyo por referencia)
# ============================================================
@router.post("/start")
async def start_session(
    request: SessionStartRequest,
    db: Session = Depends(get_db)
):
    """
    Inicia una nueva sesión para el usuario
    """
    try:
        # Cerrar cualquier sesión activa previa del usuario
        active_sessions = db.query(models.SessionLog).filter(
            models.SessionLog.user_id == request.user_id,
            models.SessionLog.is_active == True
        ).all()
        
        for session in active_sessions:
            session.is_active = False
            session.timestamp_logout = datetime.utcnow()
        
        # Crear nueva sesión
        new_session = models.SessionLog(
            user_id=request.user_id,
            username=request.username,
            timestamp_login=datetime.utcnow(),
            method="face",
            is_active=True
        )
        
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        
        return {
            "success": True,
            "message": "Sesión iniciada correctamente",
            "session_id": new_session.id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al iniciar sesión: {str(e)}")


# ============================================================
# CERRAR SESIÓN (NUEVO - IMPORTANTE)
# ============================================================
@router.post("/end")
async def end_session(
    request: SessionEndRequest,
    db: Session = Depends(get_db)
):
    """
    Cierra todas las sesiones activas del usuario
    """
    try:
        # Buscar sesiones activas
        active_sessions = db.query(models.SessionLog).filter(
            models.SessionLog.user_id == request.user_id,
            models.SessionLog.is_active == True
        ).all()
        
        if not active_sessions:
            return {
                "success": True,
                "message": "No hay sesiones activas para cerrar",
                "sessions_closed": 0
            }
        
        # Cerrar todas las sesiones activas
        sessions_closed = 0
        for session in active_sessions:
            session.is_active = False
            session.timestamp_logout = datetime.utcnow()
            sessions_closed += 1
        
        db.commit()
        
        print(f"✅ Sesiones cerradas para user_id {request.user_id}: {sessions_closed}")
        
        return {
            "success": True,
            "message": f"Se cerraron {sessions_closed} sesión(es) activa(s)",
            "sessions_closed": sessions_closed
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cerrar sesión: {str(e)}")


# ============================================================
# CERRAR TODAS LAS SESIONES HUÉRFANAS (UTILIDAD)
# ============================================================
@router.post("/cleanup-orphaned")
async def cleanup_orphaned_sessions(db: Session = Depends(get_db)):
    """
    Cierra todas las sesiones que llevan más de 24 horas activas
    (útil para limpiar sesiones que no se cerraron correctamente)
    """
    try:
        from datetime import timedelta
        
        # Sesiones activas de más de 24 horas
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        
        orphaned_sessions = db.query(models.SessionLog).filter(
            models.SessionLog.is_active == True,
            models.SessionLog.timestamp_login < cutoff_time
        ).all()
        
        sessions_closed = 0
        for session in orphaned_sessions:
            session.is_active = False
            session.timestamp_logout = datetime.utcnow()
            sessions_closed += 1
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Se limpiaron {sessions_closed} sesiones huérfanas",
            "sessions_closed": sessions_closed
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en limpieza: {str(e)}")


# ============================================================
# VERIFICAR SESIÓN ACTIVA
# ============================================================
@router.get("/check/{user_id}")
async def check_active_session(user_id: int, db: Session = Depends(get_db)):
    """
    Verifica si un usuario tiene sesión activa
    """
    try:
        active_session = db.query(models.SessionLog).filter(
            models.SessionLog.user_id == user_id,
            models.SessionLog.is_active == True
        ).first()
        
        if active_session:
            return {
                "has_active_session": True,
                "session_id": active_session.id,
                "login_time": active_session.timestamp_login.isoformat()
            }
        else:
            return {
                "has_active_session": False,
                "session_id": None,
                "login_time": None
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar sesión: {str(e)}")


# ============================================================
# PARA AGREGAR A main.py:
# ============================================================
"""
# En main.py, después de las otras rutas:

from backend.routes.session_routes import router as session_router
app.include_router(session_router)

# O si prefieres agregarlo directamente en main.py,
# copia todos los endpoints de arriba en main.py
"""