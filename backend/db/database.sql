-- =====================================================
--  BASE DE DATOS COMPLETA - SMART MIRROR
--  Ejecutar en orden para crear todo desde cero
-- =====================================================

-- =====================
-- 1. CREAR BASE DE DATOS Y USUARIO
-- =====================

-- Conectarse como superusuario postgres primero
-- CREATE DATABASE smart_mirror_db;
-- CREATE USER mirror_user WITH PASSWORD 'mirror_pass';
-- GRANT ALL PRIVILEGES ON DATABASE smart_mirror_db TO mirror_user;

-- Ahora conectarse a smart_mirror_db
-- \c smart_mirror_db

-- Dar permisos completos al usuario
GRANT ALL PRIVILEGES ON SCHEMA public TO mirror_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mirror_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mirror_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mirror_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mirror_user;


-- =====================
-- 2. CREAR TIPOS ENUM
-- =====================

-- Enums para ejercicios de voz
CREATE TYPE exercisetype AS ENUM ('breathing', 'meditation', 'vocalization', 'relaxation');
CREATE TYPE exercisecategory AS ENUM ('anxiety', 'depression', 'both');
CREATE TYPE voicerisklevel AS ENUM ('LOW', 'MODERATE', 'HIGH');


-- =====================
-- 3. TABLA: USERS
-- =====================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    age INTEGER,
    gender VARCHAR(20),
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_full_name ON users(full_name);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_admin ON users(is_admin);


-- =====================
-- 4. TABLA: ASSESSMENTS
-- =====================

CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    score INTEGER NOT NULL,
    severity VARCHAR(50) NOT NULL,
    responses JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_type ON assessments(type);
CREATE INDEX idx_assessments_created_at ON assessments(created_at);


-- =====================
-- 5. TABLA: SESSION_LOGS
-- =====================

CREATE TABLE session_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100),
    timestamp_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp_logout TIMESTAMP,
    method VARCHAR(20) DEFAULT 'face',
    is_active BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX idx_session_logs_username ON session_logs(username);
CREATE INDEX idx_session_logs_timestamp_login ON session_logs(timestamp_login);
CREATE INDEX idx_session_logs_is_active ON session_logs(is_active);


-- =====================
-- 6. TABLA: TREND_ANALYSES
-- =====================

CREATE TABLE trend_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phq9_trend VARCHAR(20),
    phq9_slope FLOAT,
    gad7_trend VARCHAR(20),
    gad7_slope FLOAT,
    multimodal_score FLOAT,
    status VARCHAR(20),
    tests_score FLOAT,
    biometrics_score FLOAT,
    voice_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trend_analyses_user_id ON trend_analyses(user_id);
CREATE INDEX idx_trend_analyses_created_at ON trend_analyses(created_at);


-- =====================
-- 7. TABLA: EXERCISES (Catálogo)
-- =====================

CREATE TABLE exercises (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category exercisecategory NOT NULL,
    exercise_type exercisetype NOT NULL,
    duration_seconds INTEGER NOT NULL,
    instructions TEXT,
    audio_guide_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercises_category ON exercises(category);


-- =====================
-- 8. TABLA: VOICE_EXERCISE_SESSIONS
-- =====================

CREATE TABLE voice_exercise_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    
    -- Biomarcadores de voz
    pitch_mean FLOAT,
    pitch_std FLOAT,
    energy FLOAT,
    voice_ratio FLOAT,
    mfcc_variability FLOAT,
    jitter FLOAT,
    shimmer FLOAT,
    hnr FLOAT,
    score FLOAT,
    risk_level voicerisklevel,
    
    -- Metadatos
    duration_seconds INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_sessions_user_id ON voice_exercise_sessions(user_id);
CREATE INDEX idx_voice_sessions_exercise_id ON voice_exercise_sessions(exercise_id);
CREATE INDEX idx_voice_sessions_created_at ON voice_exercise_sessions(created_at);
CREATE INDEX idx_voice_sessions_risk_level ON voice_exercise_sessions(risk_level);
CREATE INDEX idx_voice_sessions_completed ON voice_exercise_sessions(completed);


-- =====================
-- 9. TABLA: ATTENDANCE_RECORDS
-- =====================

CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    attended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_records_user_id ON attendance_records(user_id);
CREATE INDEX idx_attendance_records_admin_id ON attendance_records(admin_id);
CREATE INDEX idx_attendance_records_created_at ON attendance_records(created_at);


-- =====================
-- 10. TABLA: FOLLOW_UPS
-- =====================

CREATE TABLE follow_ups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_by INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX idx_follow_ups_scheduled_for ON follow_ups(scheduled_for);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_follow_ups_created_at ON follow_ups(created_at);


-- =====================================================
-- 11. INSERTAR EJERCICIOS DE EJEMPLO
-- =====================================================

-- Ejercicios para ANSIEDAD
INSERT INTO exercises (title, description, category, exercise_type, duration_seconds, instructions) VALUES
('Respiración con Vocalización', 
 'Técnica de respiración guiada con sonidos vocales para calmar tu sistema nervioso',
 'anxiety',
 'breathing',
 300,
 '1. Inhala por 4 segundos por la nariz
2. Exhala diciendo "mmm" sintiendo la vibración
3. Sostén "oooo" lo más prolongado posible
4. Repite el ciclo durante 5 minutos'),

('Lectura Consciente', 
 'Frases tranquilizadoras que te ayudan a centrarte en el momento presente',
 'anxiety',
 'meditation',
 360,
 '1. Lee en voz alta cada frase con calma
2. Haz una pausa de 6 segundos entre frases
3. Respira profundamente mientras lees
4. Observa tus sensaciones corporales'),

('Práctica Vocal', 
 'Ejercicios de voz y canto para liberar tensión y activar energía positiva',
 'anxiety',
 'vocalization',
 420,
 '1. Emite las secuencias rítmicas: Ha-Pa-Ta
2. Sigue la notación musical: Do - Re - Mi
3. Repite cada secuencia 10 veces
4. Descansa 30 segundos entre ciclos');

-- Ejercicios para DEPRESIÓN
INSERT INTO exercises (title, description, category, exercise_type, duration_seconds, instructions) VALUES
('Lectura Prosódica', 
 'Ejercicios de lectura con pausas y entonación para mejorar la expresión vocal',
 'depression',
 'meditation',
 480,
 '1. Lee el texto respetando las pausas gráficas
2. Varía la entonación según las emociones
3. Expresa las emociones del texto
4. Observa tu medidor de expresividad vocal'),

('Afirmación Vocal Dirigida', 
 'Frases positivas para fortalecer tu autoestima y confianza personal',
 'depression',
 'vocalization',
 360,
 '1. Selecciona una afirmación del banco de frases
2. Repítela en voz alta con convicción
3. Varía el tono e intensidad
4. Graba tu voz y escucha tu progreso'),

('Diálogo Guiado', 
 'Preguntas reflexivas para conectar con tus emociones y pensamientos positivos',
 'depression',
 'meditation',
 600,
 '1. Responde en voz alta a cada pregunta reflexiva
2. ¿Qué agradeces hoy?
3. ¿Qué te hace sentir bien?
4. Toma tu tiempo para reflexionar sobre tus respuestas');


-- =====================================================
-- 12. INSERTAR USUARIO ADMIN DE EJEMPLO
-- =====================================================

-- Password hasheado para: admin123
INSERT INTO users (full_name, username, password_hash, email, is_admin, created_at) VALUES
('Administrador', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIvAprzZ3i', 'admin@smartmirror.com', true, CURRENT_TIMESTAMP);


-- =====================================================
-- 13. VERIFICACIÓN
-- =====================================================

-- Verificar tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar ejercicios
SELECT id, title, category, exercise_type FROM exercises;

-- Verificar permisos
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee = 'mirror_user'
LIMIT 10;

-- Contar registros
SELECT 'users' as tabla, COUNT(*) as registros FROM users
UNION ALL
SELECT 'exercises', COUNT(*) FROM exercises
UNION ALL
SELECT 'assessments', COUNT(*) FROM assessments;


-- =====================================================
-- 14. DATOS PARA PRUEBAS (OPCIONAL)
-- =====================================================

-- Usuario de prueba
INSERT INTO users (full_name, age, gender, email, is_admin) VALUES
('Usuario Prueba', 25, 'masculino', 'prueba@test.com', false);

-- Evaluaciones de prueba
INSERT INTO assessments (user_id, type, score, severity, created_at) VALUES
(2, 'phq9', 8, 'Depresión leve', CURRENT_TIMESTAMP - INTERVAL '7 days'),
(2, 'gad7', 6, 'Ansiedad leve', CURRENT_TIMESTAMP - INTERVAL '7 days'),
(2, 'phq9', 5, 'Depresión mínima', CURRENT_TIMESTAMP);


-- =====================================================
-- ✅ SCRIPT COMPLETADO
-- =====================================================

-- Para ejecutar este script:
-- 1. Conectarse como superusuario postgres
-- 2. Ejecutar línea por línea o todo junto
-- 3. Verificar que no haya errores

-- Notas importantes:
-- - Todos los ENUMs están en MAYÚSCULAS (LOW, MODERATE, HIGH)
-- - Todos los permisos están dados al usuario mirror_user
-- - Se incluyen 6 ejercicios de ejemplo (3 ansiedad, 3 depresión)
-- - Password del admin: admin123
ALTER TABLE voice_exercise_sessions
ADD CONSTRAINT voice_exercise_sessions_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;