"""
Script para crear super administrador
Ejecutar: python -m backend.db.create_admin
"""
from backend.db.database import SessionLocal, engine, Base
from backend.db.models import User
from backend.recognition.face_service import FaceRecognitionService
import cv2

def create_super_admin():
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Verificar si ya existe un admin
    existing_admin = db.query(User).filter(User.is_admin == True).first()
    
    if existing_admin:
        print(f"❌ Ya existe un administrador: {existing_admin.full_name}")
        db.close()
        return
    
    # Crear admin
    admin = User(
        full_name="Administrador",
        is_admin=True,
        email="admin@smartmirror.com"
    )
    
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    print(f"✅ Super administrador creado: {admin.full_name} (ID: {admin.id})")
    
    # Registrar rostro del admin
    print("\n📸 Ahora registra el rostro del administrador...")
    print("Presiona ESPACIO para capturar, ESC para salir")
    
    face_service = FaceRecognitionService()
    cap = cv2.VideoCapture(0)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        cv2.imshow('Registrar Admin', frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord(' '):  # ESPACIO
            result = face_service.register("Administrador", frame)
            if result["success"]:
                print(f"✅ {result['message']}")
                break
            else:
                print(f"❌ {result['message']}")
        
        elif key == 27:  # ESC
            print("❌ Cancelado")
            break
    
    cap.release()
    cv2.destroyAllWindows()
    db.close()

if __name__ == "__main__":
    create_super_admin()
