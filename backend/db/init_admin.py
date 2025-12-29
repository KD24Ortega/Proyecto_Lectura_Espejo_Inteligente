"""
Script para inicializar el super administrador
Se ejecuta automáticamente al iniciar el servidor
"""
import os

from backend.db.database import SessionLocal
from backend.db.models import User
from backend.auth import hash_password


def init_super_admin():
    """
    Crea el super administrador si no existe
    Credenciales por defecto:
    - Usuario: admin
    - Contraseña: admin123
    """
    db = SessionLocal()
    
    try:
        admin_username = os.getenv("ADMIN_USERNAME", "admin").strip().lower()
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
        reset_password = os.getenv("RESET_ADMIN_PASSWORD", "0").strip() in {"1", "true", "TRUE", "yes", "YES"}

        # Preferir el usuario 'admin' si existe; si no, usar cualquier admin existente.
        admin = db.query(User).filter(User.username == admin_username).first()
        existing_any_admin = db.query(User).filter(User.is_admin == True).first()

        if admin:
            changed = False

            if not admin.is_admin:
                admin.is_admin = True
                changed = True

            if not admin.password_hash:
                admin.password_hash = hash_password(admin_password)
                changed = True

            if reset_password:
                admin.password_hash = hash_password(admin_password)
                changed = True

            if changed:
                db.commit()
                db.refresh(admin)
                print(f"✅ Super admin actualizado: {admin.username}")
            else:
                print(f"✅ Super administrador ya existe: {admin.username}")
            return

        if existing_any_admin and not reset_password:
            print(f"✅ Super administrador ya existe: {existing_any_admin.username}")
            return

        # Crear admin con credenciales por defecto (o env)
        hashed_password = hash_password(admin_password)

        admin = User(
            full_name="Super Administrador",
            username=admin_username,
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
        print(f"   Usuario: {admin_username}")
        print(f"   ID: {admin.id}")
        print("=" * 60)
        print("⚠️  IMPORTANTE: Cambia la contraseña en producción (usa ADMIN_PASSWORD / RESET_ADMIN_PASSWORD)")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error al crear super administrador: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_super_admin()
