from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# ==========================================
# USUARIOS Y ADMINISTRADORES
# ==========================================
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=True, index=True)  # Para admin login
    password_hash = Column(String(255), nullable=True)  # Para admin login (bcrypt)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    is_admin = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("SessionLog", back_populates="user", cascade="all, delete-orphan")
    voice_analyses = relationship("VoiceAnalysis", back_populates="user", cascade="all, delete-orphan")
    smartwatch_data = relationship("SmartwatchData", back_populates="user", cascade="all, delete-orphan")
    trends = relationship("TrendAnalysis", back_populates="user", cascade="all, delete-orphan")


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
    responses = Column(JSON, nullable=True)  # Guardar respuestas individuales
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
# ANÁLISIS DE VOZ
# ==========================================
class VoiceAnalysis(Base):
    __tablename__ = "voice_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pitch_mean = Column(Float, nullable=True)
    pitch_std = Column(Float, nullable=True)
    energy_mean = Column(Float, nullable=True)
    speech_rate = Column(Float, nullable=True)
    pause_duration = Column(Float, nullable=True)
    emotional_variability = Column(Float, nullable=True)
    risk_level = Column(String(20), nullable=True)  # 'bajo', 'moderado', 'alto'
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="voice_analyses")


# ==========================================
# DATOS DE SMARTWATCH
# ==========================================
class SmartwatchData(Base):
    __tablename__ = "smartwatch_data"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # HRV
    hrv_rmssd = Column(Float, nullable=True)
    
    # Frecuencia cardíaca
    heart_rate_resting = Column(Integer, nullable=True)
    heart_rate_mean = Column(Integer, nullable=True)
    
    # Actividad
    steps = Column(Integer, nullable=True)
    active_minutes = Column(Integer, nullable=True)
    
    # Sueño
    sleep_minutes = Column(Integer, nullable=True)
    sleep_efficiency = Column(Float, nullable=True)
    deep_sleep_minutes = Column(Integer, nullable=True)
    
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="smartwatch_data")


# ==========================================
# ANÁLISIS DE TENDENCIAS
# ==========================================
class TrendAnalysis(Base):
    __tablename__ = "trend_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Tendencias PHQ-9/GAD-7
    phq9_trend = Column(String(20), nullable=True)  # 'improving', 'stable', 'worsening'
    phq9_slope = Column(Float, nullable=True)
    gad7_trend = Column(String(20), nullable=True)
    gad7_slope = Column(Float, nullable=True)
    
    # Score multimodal (0-100)
    multimodal_score = Column(Float, nullable=True)
    status = Column(String(20), nullable=True)  # 'excellent', 'good', 'moderate', 'concerning', 'critical'
    
    # Componentes
    tests_score = Column(Float, nullable=True)
    biometrics_score = Column(Float, nullable=True)
    voice_score = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="trends")
