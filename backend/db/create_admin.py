from backend.db.database import SessionLocal
from backend.db import models
from backend.auth import hash_password

def init_super_admin():
    db = SessionLocal()

    try:
        # Verificar si existe un super admin
        admin = db.query(models.User).filter(models.User.is_admin == True).first()
        
        if admin:
            print("🟢 Super admin ya existe:", admin.username)
            return
        
        # Crear super admin
        new_admin = models.User(
            full_name="Administrador",
            username="admin",
            email="admin@mirror.com",
            password_hash=hash_password("admin123"),
            is_admin=True
        )
        
        db.add(new_admin)
        db.commit()
        
        print("🔥 Super admin creado correctamente: usuario=admin, pass=admin123")
    
    except Exception as e:
        print("❌ Error creando el super admin:", e)
    
    finally:
        db.close()
