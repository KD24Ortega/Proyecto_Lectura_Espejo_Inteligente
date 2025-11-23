from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Index, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
import enum


# Enum para género
class GenderEnum(str, enum.Enum):
    male = "m"
    female = "f"
    other = "otro"
    prefer_not_to_say = "no_decir"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    
    # ✅ CAMPOS NUEVOS
    full_name = Column(String, nullable=False, index=True)  # Nombre completo
    age = Column(Integer, nullable=True)  # Edad (opcional)
    gender = Column(String, nullable=True)  # Género
    email = Column(String, unique=True, nullable=True, index=True)  # Email (único y opcional)
    
    # Campos del sistema
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assessments = relationship("Assessment", back_populates="user")
    
    __table_args__ = (
        Index('idx_full_name_lower', 'full_name'),
    )


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    score = Column(Integer, nullable=False)
    severity = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="assessments")


class SessionLog(Base):
    __tablename__ = "session_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    username = Column(String, index=True)
    timestamp_login = Column(DateTime, default=datetime.utcnow, index=True)
    timestamp_logout = Column(DateTime, nullable=True)
    method = Column(String, default="face")
    is_active = Column(Boolean, default=False, index=True)