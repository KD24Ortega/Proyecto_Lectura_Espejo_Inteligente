from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Boolean, Float, Text, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from sqlalchemy import LargeBinary
import enum

# ==========================================
# ENUMS PARA EJERCICIOS DE VOZ
# ==========================================

class ExerciseType(enum.Enum):
    """Tipo de ejercicio"""
    BREATHING = "breathing"
    MEDITATION = "meditation"
    VOCALIZATION = "vocalization"
    RELAXATION = "relaxation"


class ExerciseCategory(enum.Enum):
    """Categoría del ejercicio"""
    ANXIETY = "anxiety"
    DEPRESSION = "depression"
    BOTH = "both"


class VoiceRiskLevel(enum.Enum):
    """Nivel de riesgo vocal"""
    LOW = "bajo"
    MODERATE = "moderado"
    HIGH = "alto"

class FaceEncoding(Base):
    """Almacena los encodings faciales en PostgreSQL"""
    __tablename__ = "face_encodings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    encoding_data = Column(JSON, nullable=False)
    encoding_version = Column(String(20), default="1.0")
    quality_score = Column(Float, nullable=True)
    
    capture_method = Column(String(50), default="registration")
    image_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    is_active = Column(Boolean, default=True, index=True)
    
    user = relationship("User", back_populates="face_encodings")

# ==========================================
# USUARIOS Y ADMINISTRADORES
# ==========================================
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    birth_date = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    is_admin = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("SessionLog", back_populates="user", cascade="all, delete-orphan")
    trends = relationship("TrendAnalysis", back_populates="user", cascade="all, delete-orphan")
    
    # Nuevas relaciones para ejercicios de voz
    voice_sessions = relationship("VoiceExerciseSession", back_populates="user", cascade="all, delete-orphan")
    
    # Relaciones para atención administrativa
    attendance_records_as_user = relationship("AttendanceRecord", foreign_keys="AttendanceRecord.user_id", back_populates="user")
    attendance_records_as_admin = relationship("AttendanceRecord", foreign_keys="AttendanceRecord.admin_id", back_populates="admin")
    followups_as_user = relationship("FollowUp", foreign_keys="FollowUp.user_id", back_populates="user")
    followups_as_creator = relationship("FollowUp", foreign_keys="FollowUp.created_by", back_populates="creator")
    face_encodings = relationship("FaceEncoding", back_populates="user", cascade="all, delete-orphan")


# ==========================================
# EVALUACIONES PSICOMÉTRICAS
# ==========================================
class Assessment(Base):
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False, index=True)  # 'phq9' o 'gad7'
    score = Column(Integer, nullable=False)
    severity = Column(String(50), nullable=False)
    responses = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="assessments")


# ==========================================
# SESIONES
# ==========================================
class SessionLog(Base):
    __tablename__ = "session_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    username = Column(String(100), index=True)
    timestamp_login = Column(DateTime, default=datetime.utcnow, index=True)
    timestamp_logout = Column(DateTime, nullable=True)
    method = Column(String(20), default="face")
    is_active = Column(Boolean, default=False, index=True)
    
    user = relationship("User", back_populates="sessions")


# ==========================================
# ANÁLISIS DE TENDENCIAS
# ==========================================
class TrendAnalysis(Base):
    __tablename__ = "trend_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Tendencias PHQ-9/GAD-7
    phq9_trend = Column(String(20), nullable=True)
    phq9_slope = Column(Float, nullable=True)
    gad7_trend = Column(String(20), nullable=True)
    gad7_slope = Column(Float, nullable=True)
    
    # Score multimodal (0-100)
    multimodal_score = Column(Float, nullable=True)
    status = Column(String(20), nullable=True)
    
    # Componentes
    tests_score = Column(Float, nullable=True)
    biometrics_score = Column(Float, nullable=True)
    voice_score = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="trends")


# ==========================================
# EJERCICIOS DE VOZ - CATÁLOGO
# ==========================================
class Exercise(Base):
    __tablename__ = "exercises"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(Enum(ExerciseCategory), nullable=False, index=True)
    exercise_type = Column(Enum(ExerciseType), nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    instructions = Column(Text, nullable=True)
    audio_guide_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relación con sesiones
    sessions = relationship("VoiceExerciseSession", back_populates="exercise")


# ==========================================
# SESIONES DE EJERCICIOS DE VOZ
# ==========================================
class VoiceExerciseSession(Base):
    __tablename__ = "voice_exercise_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    
    # Datos del análisis de voz
    pitch_mean = Column(Float, nullable=True)
    pitch_std = Column(Float, nullable=True)
    energy = Column(Float, nullable=True)
    voice_ratio = Column(Float, nullable=True)
    mfcc_variability = Column(Float, nullable=True)
    jitter = Column(Float, nullable=True)
    shimmer = Column(Float, nullable=True)
    hnr = Column(Float, nullable=True)
    score = Column(Float, nullable=True)
    risk_level = Column(Enum(VoiceRiskLevel), nullable=True, index=True)
    
    # Metadatos de la sesión
    duration_seconds = Column(Integer, nullable=True)
    completed = Column(Boolean, default=False, index=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relaciones
    user = relationship("User", back_populates="voice_sessions")
    exercise = relationship("Exercise", back_populates="sessions")


# ==========================================
# REGISTROS DE ATENCIÓN ADMINISTRATIVA
# ==========================================
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    attended_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relaciones
    user = relationship("User", foreign_keys=[user_id], back_populates="attendance_records_as_user")
    admin = relationship("User", foreign_keys=[admin_id], back_populates="attendance_records_as_admin")


# ==========================================
# SEGUIMIENTOS PROGRAMADOS
# ==========================================
class FollowUp(Base):
    __tablename__ = "follow_ups"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_for = Column(DateTime, nullable=False, index=True)
    status = Column(String(20), default="pending", index=True)  # pending, completed, cancelled
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relaciones
    user = relationship("User", foreign_keys=[user_id], back_populates="followups_as_user")
    creator = relationship("User", foreign_keys=[created_by], back_populates="followups_as_creator")


# ==========================================
# TABLAS ELIMINADAS (YA NO SE USAN)
# ==========================================
# ❌ VoiceAnalysis - Reemplazada por VoiceExerciseSession
# ❌ SmartwatchData - No se implementó smartwatch