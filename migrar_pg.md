# MIGRACIÓN SQLITE → POSTGRESQL

## 1. INSTALAR POSTGRESQL

# Descargar de: https://www.postgresql.org/download/windows/



## 2. CREAR BASE DE DATOS

-- Ejecutar como superusuario de PostgreSQL
-- psql -U postgres

-- Crear usuario
CREATE USER mirror_user WITH PASSWORD 'mirror_pass';

-- Crear base de datos
CREATE DATABASE smart_mirror_db OWNER mirror_user;

-- Dar privilegios
GRANT ALL PRIVILEGES ON DATABASE smart_mirror_db TO mirror_user;

-- Conectar a la DB
\c smart_mirror_db

-- Dar permisos al esquema
GRANT ALL ON SCHEMA public TO mirror_user;


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
export DATABASE_URL="postgresql://mirror_user:mirror_pass@localhost:5432/smart_mirror_db"

# Windows
set DATABASE_URL=postgresql://mirror_user:mirror_pass@localhost:5432/smart_mirror_db
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
