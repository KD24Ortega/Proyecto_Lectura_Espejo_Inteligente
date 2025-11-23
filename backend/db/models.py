from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False, index=True)  # ✅ Índice agregado

    assessments = relationship("Assessment", back_populates="user")
    
    # ✅ Índice adicional para búsquedas case-insensitive
    __table_args__ = (
        Index('idx_full_name_lower', 'full_name'),
    )


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # ✅ Ya tiene índice
    type = Column(String, nullable=False, index=True)  # ✅ Índice agregado para filtrar por tipo
    score = Column(Integer, nullable=False)
    severity = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # ✅ Índice para ordenar por fecha

    user = relationship("User", back_populates="assessments")


class SessionLog(Base):
    __tablename__ = "session_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)  # ✅ Ya tiene índice
    username = Column(String, index=True)  # ✅ Ya tiene índice
    timestamp_login = Column(DateTime, default=datetime.utcnow, index=True)  # ✅ Índice agregado
    timestamp_logout = Column(DateTime, nullable=True)
    method = Column(String, default="face")
    is_active = Column(Boolean, default=False, index=True)  # ✅ Índice para filtrar sesiones activas