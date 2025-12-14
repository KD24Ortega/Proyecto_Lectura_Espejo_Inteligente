# =====================================================
#  SCRIPT PARA INSERTAR EJERCICIOS DE PRUEBA
#  Ejecutar DESPUÉS de create_tables.py
# =====================================================

import sys
sys.path.append('.')

from backend.db.database import SessionLocal
from backend.db.models import Exercise, ExerciseCategory, ExerciseType
from datetime import datetime

print("🔧 Insertando ejercicios de prueba...")

db = SessionLocal()

try:
    # Verificar si ya existen ejercicios
    count = db.query(Exercise).count()
    if count > 0:
        print(f"⚠️  Ya existen {count} ejercicios en la base de datos")
        respuesta = input("¿Deseas insertar más ejercicios? (s/n): ")
        if respuesta.lower() != 's':
            print("❌ Operación cancelada")
            exit()
    
    # Ejercicios para ANSIEDAD
    ejercicios_ansiedad = [
        Exercise(
            title="Respiración con Vocalización",
            description="Técnica de respiración guiada con sonidos vocales para calmar tu sistema nervioso",
            category=ExerciseCategory.ANXIETY,
            exercise_type=ExerciseType.BREATHING,
            duration_seconds=300,
            instructions="""1. Inhala por 4 segundos
2. Exhala diciendo "mmm"
3. Sostén "oooo" lo más posible
4. Repite el ciclo"""
        ),
        Exercise(
            title="Lectura Consciente",
            description="Frases tranquilizadoras que te ayudan a centrarte en el momento presente",
            category=ExerciseCategory.ANXIETY,
            exercise_type=ExerciseType.MEDITATION,
            duration_seconds=360,
            instructions="""1. Lee en voz alta cada frase
2. Pausa 6 segundos entre frases
3. Respira profundamente
4. Observa tus sensaciones"""
        ),
        Exercise(
            title="Práctica Vocal",
            description="Ejercicios de voz y canto para liberar tensión y activar energía positiva",
            category=ExerciseCategory.ANXIETY,
            exercise_type=ExerciseType.VOCALIZATION,
            duration_seconds=420,
            instructions="""1. Emite secuencias: Ha-Pa-Ta
2. Sigue la notación musical
3. Repite 10 veces
4. Descansa entre ciclos"""
        )
    ]
    
    # Ejercicios para DEPRESIÓN
    ejercicios_depresion = [
        Exercise(
            title="Lectura Prosódica",
            description="Ejercicios de lectura con pausas y entonación para mejorar la expresión vocal",
            category=ExerciseCategory.DEPRESSION,
            exercise_type=ExerciseType.MEDITATION,
            duration_seconds=480,
            instructions="""1. Lee el texto con pausas marcadas
2. Varía la entonación
3. Expresa las emociones
4. Mide tu expresividad"""
        ),
        Exercise(
            title="Afirmación Vocal Dirigida",
            description="Frases positivas para fortalecer tu autoestima y confianza personal",
            category=ExerciseCategory.DEPRESSION,
            exercise_type=ExerciseType.VOCALIZATION,
            duration_seconds=360,
            instructions="""1. Selecciona una afirmación
2. Repítela con convicción
3. Graba tu voz
4. Escucha y reflexiona"""
        ),
        Exercise(
            title="Diálogo Guiado",
            description="Preguntas reflexivas para conectar con tus emociones y pensamientos positivos",
            category=ExerciseCategory.DEPRESSION,
            exercise_type=ExerciseType.MEDITATION,
            duration_seconds=600,
            instructions="""1. Responde en voz alta
2. ¿Qué agradeces hoy?
3. ¿Qué te hace sentir bien?
4. Reflexiona sobre tus respuestas"""
        )
    ]
    
    # Insertar todos los ejercicios
    todos_ejercicios = ejercicios_ansiedad + ejercicios_depresion
    
    for ejercicio in todos_ejercicios:
        db.add(ejercicio)
    
    db.commit()
    
    print(f"\n✅ {len(todos_ejercicios)} ejercicios insertados correctamente!")
    
    # Mostrar resumen
    print("\n📋 RESUMEN:")
    print(f"  • Ansiedad: {len(ejercicios_ansiedad)} ejercicios")
    print(f"  • Depresión: {len(ejercicios_depresion)} ejercicios")
    
    # Verificar
    total = db.query(Exercise).count()
    print(f"\n📊 Total de ejercicios en BD: {total}")
    
    print("\n✨ ¡Todo listo! Ahora puedes usar los ejercicios de voz.")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    db.rollback()
finally:
    db.close()