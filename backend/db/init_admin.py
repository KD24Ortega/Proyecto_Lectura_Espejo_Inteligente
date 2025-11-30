"""
Script para inicializar el super administrador
Se ejecuta automáticamente al iniciar el servidor
"""
from backend.db.database import SessionLocal, Base, engine
from backend.db.models import User
from backend.auth import hash_password


def init_super_admin():
    """
    Crea el super administrador si no existe
    Credenciales por defecto:
    - Usuario: admin
    - Contraseña: admin123
    """
    # Crear todas las tablas si no existen
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Verificar si ya existe un admin
        existing_admin = db.query(User).filter(User.is_admin == True).first()
        
        if existing_admin:
            print(f"✅ Super administrador ya existe: {existing_admin.username}")
            return
        
        # Crear admin con credenciales por defecto
        hashed_password = hash_password("admin123")
        
        admin = User(
            full_name="Super Administrador",
            username="admin",
            password_hash=hashed_password,
            is_admin=True,
            email="admin@smartmirror.com"
        )
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        print("=" * 60)
        print("✅ SUPER ADMINISTRADOR CREADO EXITOSAMENTE")
        print("=" * 60)
        print(f"   Usuario: admin")
        print(f"   Contraseña: admin123")
        print(f"   ID: {admin.id}")
        print("=" * 60)
        print("⚠️  IMPORTANTE: Cambia la contraseña en producción")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error al crear super administrador: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_super_admin()
