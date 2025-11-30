import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # PostgreSQL
    POSTGRES_USER = os.getenv("POSTGRES_USER", "mirror_user")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "mirror_password_2024")
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "smart_mirror_db")
    
    # SQLite (para migración)
    SQLITE_DB = "mirror.db"
    
    # JWT Secret (para admin auth)
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    
    @property
    def DATABASE_URL(self):
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def SQLITE_URL(self):
        return f"sqlite:///./{self.SQLITE_DB}"

settings = Settings()