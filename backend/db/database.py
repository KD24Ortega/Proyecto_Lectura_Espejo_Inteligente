from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://mirror_user:mirror_pass@localhost:5432/smart_mirror_db"
)

# ========================================
# CONFIGURACIÓN OPTIMIZADA PARA CARGA
# ========================================
engine = create_engine(
    DATABASE_URL,
    # Pool de conexiones aumentado para soportar múltiples usuarios concurrentes
    pool_size=20,           # De 5 → 20: Conexiones permanentes en el pool
    max_overflow=30,        # De 10 → 30: Conexiones adicionales temporales
    pool_timeout=60,        # De 30 → 60: Tiempo de espera para obtener conexión
    pool_recycle=3600,      # Reciclar conexiones cada hora (evita conexiones "muertas")
    pool_pre_ping=True,     # Verificar conexión antes de usarla (evita errores)
    
    # Opciones adicionales para mejor rendimiento
    echo=False,             # No imprimir SQL queries (mejor performance)
    future=True,            # Usar API moderna de SQLAlchemy
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    Dependency para obtener sesión de base de datos.
    Garantiza que la sesión se cierre correctamente después de cada request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ========================================
# FUNCIONES AUXILIARES PARA MONITOREO
# ========================================
def get_pool_status():
    """
    Obtiene el estado actual del pool de conexiones.
    Útil para debugging y monitoreo.
    """
    pool = engine.pool
    return {
        "size": pool.size(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "checked_in": pool.checkedin(),
        "max_overflow": pool._max_overflow,
        "pool_size": pool._pool.maxsize,
    }


def check_connection():
    """
    Verifica que la conexión a la base de datos esté funcionando.
    Útil para health checks.
    """
    try:
        connection = engine.connect()
        connection.execute("SELECT 1")
        connection.close()
        return True
    except Exception as e:
        print(f"Error al conectar con la base de datos: {e}")
        return False

