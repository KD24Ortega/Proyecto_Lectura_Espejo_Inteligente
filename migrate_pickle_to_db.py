#!/usr/bin/env python3
"""
Script de Migración: Encodings.pkl → PostgreSQL
Migra los encodings faciales del archivo pickle a la base de datos
"""

import pickle
import os
from datetime import datetime
from sqlalchemy.orm import Session

# Configurar path para imports
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db.database import engine, get_db
from backend.db import models


def migrate_encodings_to_database():
    """
    Migra encodings del archivo pickle a la base de datos
    """
    
    print("=" * 70)
    print("  MIGRACIÓN: encodings.pkl → PostgreSQL")
    print("=" * 70)
    print()
    
    # Ruta del archivo pickle
    pickle_file = "backend/recognition/data/encodings.pkl"
    
    if not os.path.exists(pickle_file):
        print(f"❌ No se encontró el archivo: {pickle_file}")
        print("   No hay datos para migrar")
        return False
    
    print(f"📁 Archivo encontrado: {pickle_file}")
    
    # Cargar datos del pickle
    print("📂 Cargando datos del pickle...")
    try:
        with open(pickle_file, "rb") as f:
            data = pickle.load(f)
    except Exception as e:
        print(f"❌ Error cargando pickle: {e}")
        return False
    
    # Determinar formato
    if "user_encodings" in data:
        # Formato nuevo (múltiples encodings por usuario)
        print("✅ Formato detectado: Nuevo (múltiples encodings)")
        user_encodings = data["user_encodings"]
        user_metadata = data.get("user_metadata", {})
    elif "encodings" in data and "users" in data:
        # Formato antiguo (un encoding por usuario)
        print("✅ Formato detectado: Antiguo (un encoding por usuario)")
        user_encodings = {}
        for user, enc in zip(data["users"], data["encodings"]):
            user_encodings[user] = [enc]
        user_metadata = {}
    else:
        print("❌ Formato de pickle no reconocido")
        return False
    
    total_users = len(user_encodings)
    total_encodings = sum(len(encs) for encs in user_encodings.values())
    
    print(f"\n📊 Datos a migrar:")
    print(f"   - Usuarios: {total_users}")
    print(f"   - Encodings totales: {total_encodings}")
    print()
    
    # Obtener sesión de BD
    db = next(get_db())
    
    migrated_users = 0
    migrated_encodings = 0
    errors = []
    
    try:
        for username, encodings_list in user_encodings.items():
            print(f"🔄 Procesando: {username}")
            
            # Buscar usuario en BD
            user = db.query(models.User).filter(
                models.User.full_name.ilike(username)
            ).first()
            
            if not user:
                print(f"   ⚠️ Usuario '{username}' no encontrado en BD")
                errors.append(f"Usuario no encontrado: {username}")
                continue
            
            print(f"   ✅ Usuario encontrado en BD (ID: {user.id})")
            
            # Verificar si ya tiene encodings
            existing = db.query(models.FaceEncoding).filter(
                models.FaceEncoding.user_id == user.id,
                models.FaceEncoding.is_active == True
            ).count()
            
            if existing > 0:
                print(f"   ⚠️ Usuario ya tiene {existing} encoding(s) en BD")
                print(f"   ℹ️ Se agregarán {len(encodings_list)} adicionales")
            
            # Migrar cada encoding
            for idx, encoding in enumerate(encodings_list, 1):
                metadata = user_metadata.get(username, {})
                
                face_encoding = models.FaceEncoding(
                    user_id=user.id,
                    encoding_data=encoding.tolist(),  # Convertir numpy a lista
                    encoding_version="1.0",
                    quality_score=None,  # No disponible en datos antiguos
                    capture_method="migrated_from_pickle",
                    image_metadata=None,
                    is_active=True
                )
                
                db.add(face_encoding)
                migrated_encodings += 1
                
                print(f"   ✓ Encoding {idx}/{len(encodings_list)} agregado")
            
            migrated_users += 1
            
            # Commit por usuario
            db.commit()
            print(f"   💾 Guardado en BD\n")
        
        print("=" * 70)
        print("  MIGRACIÓN COMPLETADA")
        print("=" * 70)
        print(f"\n✅ Resumen:")
        print(f"   - Usuarios migrados: {migrated_users}/{total_users}")
        print(f"   - Encodings migrados: {migrated_encodings}/{total_encodings}")
        
        if errors:
            print(f"\n⚠️ Errores encontrados: {len(errors)}")
            for error in errors:
                print(f"   - {error}")
        
        # Crear respaldo del pickle
        backup_file = f"{pickle_file}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(pickle_file, backup_file)
        print(f"\n💾 Respaldo creado: {backup_file}")
        
        return True
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error durante migración: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def verify_migration():
    """Verifica que la migración fue exitosa"""
    
    print("\n" + "=" * 70)
    print("  VERIFICACIÓN DE MIGRACIÓN")
    print("=" * 70)
    print()
    
    db = next(get_db())
    
    try:
        # Contar encodings en BD
        total_encodings = db.query(models.FaceEncoding).filter(
            models.FaceEncoding.is_active == True
        ).count()
        
        total_users = db.query(models.FaceEncoding.user_id).filter(
            models.FaceEncoding.is_active == True
        ).distinct().count()
        
        print(f"📊 Datos en PostgreSQL:")
        print(f"   - Usuarios con encodings: {total_users}")
        print(f"   - Encodings totales: {total_encodings}")
        print()
        
        # Listar usuarios
        users = db.query(
            models.User.id,
            models.User.full_name,
            models.FaceEncoding.id
        ).join(models.FaceEncoding).filter(
            models.FaceEncoding.is_active == True
        ).all()
        
        if users:
            print("👥 Usuarios con encodings:")
            user_counts = {}
            for user in users:
                user_counts[user.full_name] = user_counts.get(user.full_name, 0) + 1
            
            for name, count in user_counts.items():
                print(f"   - {name}: {count} encoding(s)")
        
        print("\n✅ Verificación completada")
        
    except Exception as e:
        print(f"❌ Error en verificación: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "🔄" * 35)
    print()
    
    # Ejecutar migración
    success = migrate_encodings_to_database()
    
    if success:
        # Verificar migración
        verify_migration()
        
        print("\n" + "=" * 70)
        print("  PRÓXIMOS PASOS")
        print("=" * 70)
        print()
        print("1. Verificar que todos los usuarios fueron migrados")
        print("2. Probar el reconocimiento facial con el nuevo sistema")
        print("3. Si todo funciona correctamente:")
        print("   - Puedes eliminar o archivar el archivo encodings.pkl")
        print("   - Actualizar face_service.py con la versión de base de datos")
        print()
    else:
        print("\n❌ Migración falló. Revisa los errores arriba.")
    
    print("🔄" * 35 + "\n")