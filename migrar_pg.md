# MIGRACIÓN SQLITE → POSTGRESQL

## 1. INSTALAR POSTGRESQL

# Descargar de: https://www.postgresql.org/download/windows/



## 2. CREAR BASE DE DATOS

-- Ejecutar como superusuario de PostgreSQL
-- psql -U postgres

-- Crear usuario
CREATE USER calmasense_user WITH PASSWORD 'calmasense_pass';

-- Crear base de datos
CREATE DATABASE calmasense_db OWNER calmasense_user;

-- Dar privilegios
GRANT ALL PRIVILEGES ON DATABASE calmasense_db TO calmasense_user;

-- Conectar a la DB
\c calmasense_db

-- Dar permisos al esquema
GRANT ALL ON SCHEMA public TO calmasense_user;


## 3. INSTALAR DEPENDENCIAS

```bash
pip install -r utils/requirements.txt
```

## 4. CREAR TABLAS

```bash
# Python creará automáticamente las tablas al iniciar
python -c "from backend.db.database import Base, engine; from backend.db import models; Base.metadata.create_all(bind=engine)"
```

## 5. CREAR SUPER ADMINISTRADOR

```bash
python -m backend.db.create_admin
```

## 6. VARIABLES DE ENTORNO (OPCIONAL)

```bash
# Linux/macOS
export DATABASE_URL="postgresql://calmasense_user:calmasense_pass@localhost:5432/calmasense_db"

# Windows
set DATABASE_URL=postgresql://calmasense_user:calmasense_pass@localhost:5432/calmasense_db
```

## ESTRUCTURA DE TABLAS

- **users**: Usuarios (con flag is_admin)
- **assessments**: PHQ-9 y GAD-7
- **session_logs**: Historial de sesiones
- **voice_analyses**: Análisis de voz
- **smartwatch_data**: Datos de wearables
- **trend_analyses**: Análisis de tendencias

## ENDPOINTS ADMIN

- `GET /admin/dashboard?user_id={admin_id}` - Estadísticas generales
- `GET /admin/users?user_id={admin_id}` - Listar todos los usuarios
- `GET /admin/user/{target_id}?user_id={admin_id}` - Detalles de un usuario
- `DELETE /admin/user/{target_id}?user_id={admin_id}` - Eliminar usuario

**IMPORTANTE:** Todos requieren `user_id` del admin en query params.

-- sin datos enum
DROP TABLE IF EXISTS voice_exercise_sessions CASCADE;

CREATE TABLE voice_exercise_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    pitch_mean FLOAT,
    pitch_std FLOAT,
    energy FLOAT,
    voice_ratio FLOAT,
    mfcc_variability FLOAT,
    jitter FLOAT,
    shimmer FLOAT,
    hnr FLOAT,
    score FLOAT,
    risk_level VARCHAR(20),  -- Sin ENUM, solo VARCHAR
    duration_seconds INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Dar permisos al usuario calmasense_user
GRANT ALL PRIVILEGES ON TABLE voice_exercise_sessions TO calmasense_user;
GRANT USAGE, SELECT ON SEQUENCE voice_exercise_sessions_id_seq TO calmasense_user;

-- También dar permisos a otras tablas relacionadas por si acaso
GRANT ALL PRIVILEGES ON TABLE exercises TO calmasense_user;
GRANT ALL PRIVILEGES ON TABLE attendance_records TO calmasense_user;
GRANT ALL PRIVILEGES ON TABLE follow_ups TO calmasense_user;

-- Dar permisos a TODAS las secuencias
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO calmasense_user;

-- Verificar permisos
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='voice_exercise_sessions';