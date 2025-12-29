"""Seed default exercises into the database.

The frontend uses fixed exercise_id values (e.g. 2 for "Lectura Consciente").
In a fresh production database created via SQLAlchemy `create_all`, the exercises
catalog is empty unless seeded.

This module seeds the canonical set of 6 exercises if the exercises table is
empty.
"""

from __future__ import annotations

from backend.db.database import SessionLocal
from backend.db import models


def seed_exercises_if_empty() -> None:
    db = SessionLocal()
    try:
        existing = db.query(models.Exercise).limit(1).first()
        if existing is not None:
            return

        exercises_to_create: list[models.Exercise] = [
            # Ansiedad
            models.Exercise(
                title="Respiración con Vocalización",
                description="Técnica de respiración guiada con sonidos vocales para calmar tu sistema nervioso",
                category=models.ExerciseCategory.ANXIETY,
                exercise_type=models.ExerciseType.BREATHING,
                duration_seconds=300,
                instructions=(
                    "1. Inhala por 4 segundos por la nariz\n"
                    "2. Exhala diciendo \"mmm\" sintiendo la vibración\n"
                    "3. Sostén \"oooo\" lo más prolongado posible\n"
                    "4. Repite el ciclo durante 5 minutos"
                ),
            ),
            models.Exercise(
                title="Lectura Consciente",
                description="Frases tranquilizadoras que te ayudan a centrarte en el momento presente",
                category=models.ExerciseCategory.ANXIETY,
                exercise_type=models.ExerciseType.MEDITATION,
                duration_seconds=360,
                instructions=(
                    "1. Lee en voz alta cada frase con calma\n"
                    "2. Haz una pausa de 6 segundos entre frases\n"
                    "3. Respira profundamente mientras lees\n"
                    "4. Observa tus sensaciones corporales"
                ),
            ),
            models.Exercise(
                title="Práctica Vocal",
                description="Ejercicios de voz y canto para liberar tensión y activar energía positiva",
                category=models.ExerciseCategory.ANXIETY,
                exercise_type=models.ExerciseType.VOCALIZATION,
                duration_seconds=420,
                instructions=(
                    "1. Emite las secuencias rítmicas: Ha-Pa-Ta\n"
                    "2. Sigue la notación musical: Do - Re - Mi\n"
                    "3. Repite cada secuencia 10 veces\n"
                    "4. Descansa 30 segundos entre ciclos"
                ),
            ),

            # Depresión
            models.Exercise(
                title="Lectura Prosódica",
                description="Ejercicios de lectura con pausas y entonación para mejorar la expresión vocal",
                category=models.ExerciseCategory.DEPRESSION,
                exercise_type=models.ExerciseType.MEDITATION,
                duration_seconds=480,
                instructions=(
                    "1. Lee el texto respetando las pausas gráficas\n"
                    "2. Varía la entonación según las emociones\n"
                    "3. Expresa las emociones del texto\n"
                    "4. Observa tu medidor de expresividad vocal"
                ),
            ),
            models.Exercise(
                title="Afirmación Vocal Dirigida",
                description="Frases positivas para fortalecer tu autoestima y confianza personal",
                category=models.ExerciseCategory.DEPRESSION,
                exercise_type=models.ExerciseType.VOCALIZATION,
                duration_seconds=360,
                instructions=(
                    "1. Selecciona una afirmación del banco de frases\n"
                    "2. Repítela en voz alta con convicción\n"
                    "3. Varía el tono e intensidad\n"
                    "4. Graba tu voz y escucha tu progreso"
                ),
            ),
            models.Exercise(
                title="Diálogo Guiado",
                description="Preguntas reflexivas para conectar con tus emociones y pensamientos positivos",
                category=models.ExerciseCategory.DEPRESSION,
                exercise_type=models.ExerciseType.MEDITATION,
                duration_seconds=600,
                instructions=(
                    "1. Responde en voz alta a cada pregunta reflexiva\n"
                    "2. ¿Qué agradeces hoy?\n"
                    "3. ¿Qué te hace sentir bien?\n"
                    "4. Toma tu tiempo para reflexionar sobre tus respuestas"
                ),
            ),
        ]

        db.add_all(exercises_to_create)
        db.commit()
        print("✅ Ejercicios sembrados: 6")
    except Exception as e:
        db.rollback()
        print(f"❌ Error sembrando ejercicios: {e}")
    finally:
        db.close()
