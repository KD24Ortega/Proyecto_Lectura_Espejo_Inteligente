from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import make_url
import os

from .config import settings


def _normalize_database_url(url: str) -> str:
    # Some providers use the deprecated scheme "postgres://".
    # SQLAlchemy expects "postgresql://".
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def _sanitize_database_url(url: str) -> str:
    """Return a URL safe to print in logs (no password)."""
    try:
        parsed = make_url(url)
        if parsed.password is not None:
            parsed = parsed.set(password="***")
        return str(parsed)
    except Exception:
        # Fallback: best-effort redaction
        return url.replace(os.getenv("PGPASSWORD", ""), "***") if url else url


def get_database_url() -> str:
    """Resolve the database URL from env vars (Railway-friendly) with safe fallbacks."""
    # Railway / common provider conventions
    for key in ("DATABASE_URL", "POSTGRES_URL", "RAILWAY_DATABASE_URL", "DATABASE_PUBLIC_URL"):
        value = os.getenv(key)
        if value:
            os.environ["DB_URL_SOURCE"] = key
            return _normalize_database_url(value)

    # Standard libpq env vars
    pghost = os.getenv("PGHOST")
    if pghost:
        pguser = os.getenv("PGUSER") or settings.POSTGRES_USER
        pgpassword = os.getenv("PGPASSWORD") or settings.POSTGRES_PASSWORD
        pgport = os.getenv("PGPORT") or settings.POSTGRES_PORT
        pgdatabase = os.getenv("PGDATABASE") or settings.POSTGRES_DB
        os.environ["DB_URL_SOURCE"] = "PG*"
        return _normalize_database_url(
            f"postgresql://{pguser}:{pgpassword}@{pghost}:{pgport}/{pgdatabase}"
        )

    # Local/dev fallback
    if any(
        os.getenv(k)
        for k in (
            "POSTGRES_HOST",
            "POSTGRES_PORT",
            "POSTGRES_DB",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
        )
    ):
        os.environ["DB_URL_SOURCE"] = "POSTGRES_*"
    else:
        os.environ["DB_URL_SOURCE"] = "settings.DATABASE_URL"
    return _normalize_database_url(settings.DATABASE_URL)


DATABASE_URL = get_database_url()

# Log once at import time (safe, no password) to make Railway misconfigurations obvious.
try:
    print(f"✅ DB config source: {os.getenv('DB_URL_SOURCE', 'unknown')}")
    print(f"✅ DB config url: {_sanitize_database_url(DATABASE_URL)}")
except Exception:
    pass

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

