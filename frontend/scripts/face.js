const API = "http://127.0.0.1:8000";

let video;
let scanning = false;
let loopId = null;
let currentSessionId = null;
let currentUser = null;
let lastDetectionTime = null;
let presenceCheckInterval = null;

// Configuración
const RECOGNITION_INTERVAL = 1200;
const PRESENCE_CHECK_INTERVAL = 2000;
const SESSION_TIMEOUT = 10000;

// ===============================
// Inicializar cámara
// ===============================
async function initCamera() {
    video = document.getElementById("video");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
        video.onloadedmetadata = () => resolve();
    });
}

// ===============================
// APAGAR CÁMARA
// ===============================
function stopCamera() {
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        console.log("📷 Cámara apagada");
    }
}

// ===============================
// Capturar frame
// ===============================
async function captureFrame() {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => {
        canvas.toBlob(resolve, "image/jpeg", 0.95);
    });
}

// ===============================
// DETENER TODO
// ===============================
function stopEverything() {
    scanning = false;
    if (loopId !== null) {
        clearInterval(loopId);
        loopId = null;
    }
    if (presenceCheckInterval) {
        clearInterval(presenceCheckInterval);
        presenceCheckInterval = null;
    }
    stopCamera();
    console.log("🛑 TODO DETENIDO");
}

// ===============================
// Modo Standby - LOGIN
// ===============================
async function startStandbyMode() {
    console.log("🔵 Iniciando modo Standby...");
    
    await initCamera();
    scanning = true;

    const status = document.getElementById("status");
    const registerBtn = document.getElementById("registerBtn");

    loopId = setInterval(async () => {
        if (!scanning) return;

        try {
            const blob = await captureFrame();
            const formData = new FormData();
            formData.append("file", blob, "frame.jpg");

            const res = await fetch(`${API}/face/recognize`, {
                method: "POST",
                body: formData
            });

            const result = await res.json();

            // Sin rostro
            if (!result.found) {
                if (status) status.textContent = "Ningún rostro detectado...";
                if (registerBtn) registerBtn.classList.add("hidden");
                return;
            }

            // Rostro no registrado
            if (result.user === null) {
                if (status) status.textContent = "Rostro no reconocido";
                if (registerBtn) registerBtn.classList.remove("hidden");
                return;
            }

            // ✅ USUARIO RECONOCIDO
            if (result.login_complete === true) {
                console.log(`✅ LOGIN EXITOSO: ${result.user}`);
                
                // DETENER TODO INMEDIATAMENTE
                stopEverything();
                
                if (status) {
                    status.textContent = `✓ Sesión iniciada. Redirigiendo...`;
                    status.classList.add("success");
                }

                // Guardar en sessionStorage para recuperar en index.html
                sessionStorage.setItem("session_id", result.session_id);
                sessionStorage.setItem("username", result.user);

                console.log("🚀 Redirigiendo en 1 segundo...");
                
                // Redirigir
                setTimeout(() => {
                    window.location.href = "/static/user/index.html";  // ✅ CORREGIDO
                }, 1000);
            }

        } catch (error) {
            console.error("Error:", error);
        }

    }, RECOGNITION_INTERVAL);
}

// ===============================
// Cerrar sesión
// ===============================
async function endSession() {
    if (!currentSessionId) return;

    try {
        await fetch(`${API}/session/end/${currentSessionId}`, {
            method: "POST"
        });
        console.log("✓ Sesión cerrada");
    } catch (error) {
        console.error("Error cerrando sesión:", error);
    }

    stopEverything();
    sessionStorage.clear();
    window.location.href = "/static/account/login.html";  // ✅ CORRECTO
}

// ===============================
// MONITOREO DE PRESENCIA
// ===============================
async function checkPresence() {
    try {
        const blob = await captureFrame();
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");

        const res = await fetch(`${API}/face/recognize/check`, {
            method: "POST",
            body: formData
        });

        const result = await res.json();

        // Usuario presente
        if (result.found && result.user === currentUser) {
            lastDetectionTime = Date.now();
            console.log(`✓ ${currentUser} presente`);
            
            const indicator = document.getElementById("presenceIndicator");
            if (indicator) {
                indicator.textContent = "● Presencia detectada";
                indicator.className = "presence-indicator presence-active";
            }
            return;
        }

        // Verificar timeout
        const timeSince = Date.now() - lastDetectionTime;
        
        if (timeSince >= SESSION_TIMEOUT) {
            console.log("⏱️ Timeout - cerrando sesión");
            alert("Sesión cerrada: no se detectó tu presencia");
            await endSession();
        } else {
            const remaining = Math.ceil((SESSION_TIMEOUT - timeSince) / 1000);
            console.log(`⚠️ No detectado (${remaining}s)`);
            
            const indicator = document.getElementById("presenceIndicator");
            if (indicator) {
                indicator.textContent = `⚠ Sin presencia (${remaining}s)`;
                indicator.className = "presence-indicator presence-warning";
            }
        }
    } catch (error) {
        console.error("Error en checkPresence:", error);
    }
}

// ===============================
// Modo Activo - MONITOREO
// ===============================
async function startActiveMode() {
    // Recuperar datos de sessionStorage
    currentSessionId = sessionStorage.getItem("session_id");
    currentUser = sessionStorage.getItem("username");

    if (!currentSessionId || !currentUser) {
        console.error("❌ No hay datos de sesión");
        window.location.href = "/static/account/login.html";  // ✅ CORRECTO
        return;
    }

    console.log(`🟢 Modo activo: ${currentUser} (sesión ${currentSessionId})`);
    
    // Mostrar nombre de usuario
    const welcomeEl = document.getElementById("welcome");
    if (welcomeEl) {
        welcomeEl.textContent = `Bienvenido, ${currentUser}`;
    }

    // Iniciar cámara para monitoreo
    await initCamera();
    lastDetectionTime = Date.now();
    
    // Iniciar monitoreo cada 2 segundos
    presenceCheckInterval = setInterval(() => {
        checkPresence();
    }, PRESENCE_CHECK_INTERVAL);
}

// ===============================
// Ir a registro
// ===============================
function goRegister() {
    stopEverything();
    window.location.href = "/static/account/register.html";  // ✅ CORRECTO
}