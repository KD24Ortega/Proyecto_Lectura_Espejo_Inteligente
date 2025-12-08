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
// UTILIDADES - Mostrar mensajes al usuario
// ===============================
function showError(message) {
    const status = document.getElementById("status");
    if (status) {
        status.textContent = message;
        status.className = "status error";
    }
    console.error(message);
}

function showSuccess(message) {
    const status = document.getElementById("status");
    if (status) {
        status.textContent = message;
        status.className = "status success";
    }
    console.log(message);
}

function showInfo(message) {
    const status = document.getElementById("status");
    if (status) {
        status.textContent = message;
        status.className = "status scanning";
    }
}

// ===============================
// Inicializar cámara
// ===============================
async function initCamera() {
    try {
        video = document.getElementById("video");
        
        if (!video) {
            throw new Error("Elemento de video no encontrado");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        video.srcObject = stream;
        
        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                console.log("✓ Cámara inicializada");
                resolve();
            };
            video.onerror = () => {
                reject(new Error("Error al cargar el video"));
            };
            
            // Timeout por si no carga
            setTimeout(() => {
                reject(new Error("Timeout al inicializar cámara"));
            }, 5000);
        });
    } catch (error) {
        console.error("Error al acceder a la cámara:", error);
        
        if (error.name === 'NotAllowedError') {
            showError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.");
        } else if (error.name === 'NotFoundError') {
            showError("No se encontró ninguna cámara en tu dispositivo.");
        } else {
            showError("Error al inicializar la cámara: " + error.message);
        }
        
        throw error;
    }
}

// ===============================
// APAGAR CÁMARA
// ===============================
function stopCamera() {
    try {
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => {
                track.stop();
                console.log(`✓ Track ${track.kind} detenido`);
            });
            video.srcObject = null;
            console.log("📷 Cámara apagada completamente");
        }
    } catch (error) {
        console.error("Error al detener la cámara:", error);
    }
}

// ===============================
// Capturar frame
// ===============================
async function captureFrame() {
    try {
        if (!video || !video.videoWidth || !video.videoHeight) {
            throw new Error("Video no está listo");
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
            throw new Error("No se pudo obtener contexto de canvas");
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("No se pudo crear el blob"));
                    }
                },
                "image/jpeg",
                0.95
            );
        });
    } catch (error) {
        console.error("Error al capturar frame:", error);
        return null;
    }
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
// Verificar conectividad con el backend
// ===============================
async function checkBackendHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${API}/health`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            console.log("✓ Backend conectado");
            return true;
        } else {
            console.error("❌ Backend respondió con error:", response.status);
            return false;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error("❌ Timeout al conectar con backend");
            showError("El servidor no responde. Verifica que esté ejecutándose.");
        } else {
            console.error("❌ Error al conectar con backend:", error);
            showError("No se puede conectar con el servidor.");
        }
        return false;
    }
}

// ===============================
// Modo Standby - LOGIN
// ===============================
async function startStandbyMode() {
    console.log("🔵 Iniciando modo Standby...");
    
    // Verificar backend primero
    const backendOk = await checkBackendHealth();
    if (!backendOk) {
        showError("Backend no disponible. Por favor, inicia el servidor.");
        return;
    }
    
    // Inicializar cámara
    try {
        await initCamera();
        showInfo("Escaneando rostro...");
    } catch (error) {
        return; // Ya se mostró el error en initCamera
    }

    scanning = true;
    const status = document.getElementById("status");
    const registerBtn = document.getElementById("registerBtn");

    loopId = setInterval(async () => {
        if (!scanning) return;

        try {
            const blob = await captureFrame();
            
            if (!blob) {
                console.warn("No se pudo capturar frame, saltando ciclo");
                return;
            }

            const formData = new FormData();
            formData.append("file", blob, "frame.jpg");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(`${API}/face/recognize`, {
                method: "POST",
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const result = await res.json();

            // Sin rostro
            if (!result.found) {
                showInfo("Ningún rostro detectado...");
                if (registerBtn) registerBtn.classList.add("hidden");
                return;
            }

            // Rostro no registrado
            if (result.user === null) {
                showInfo("Rostro no reconocido");
                if (registerBtn) registerBtn.classList.remove("hidden");
                return;
            }

            // ✅ USUARIO RECONOCIDO
            if (result.login_complete === true) {
                console.log(`✅ LOGIN EXITOSO: ${result.user}`);
                
                stopEverything();
                showSuccess(`✓ Bienvenido ${result.user}. Redirigiendo...`);

                // Guardar TANTO session_id COMO user_id
                sessionStorage.setItem("session_id", result.session_id);
                sessionStorage.setItem("user_id", result.user_id);  // 🔥 AGREGAR ESTO
                sessionStorage.setItem("username", result.user);

                console.log("🚀 Redirigiendo en 1 segundo...");
                
                setTimeout(() => {
                    window.location.href = "/static/user/index.html";
                }, 1000);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error("Timeout en reconocimiento facial");
                showError("Timeout al procesar imagen. Reintentando...");
            } else {
                console.error("Error en reconocimiento:", error);
                showError("Error al procesar: " + error.message);
            }
            
            // Continuar intentando después de un error
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

    }, RECOGNITION_INTERVAL);
}

// ===============================
// Cerrar sesión
// ===============================
async function endSession() {
    if (!currentSessionId) {
        console.log("No hay sesión activa para cerrar");
        window.location.href = "/static/account/login.html";
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${API}/session/end/${currentSessionId}`, {
            method: "POST",
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
            console.log("✓ Sesión cerrada correctamente");
        } else {
            console.error("Error al cerrar sesión:", res.status);
        }
    } catch (error) {
        console.error("Error cerrando sesión:", error);
        // Continuar con el cierre aunque falle
    }

    stopEverything();
    sessionStorage.clear();
    window.location.href = "/static/account/login.html";
}

// ===============================
// MONITOREO DE PRESENCIA
// ===============================
async function checkPresence() {
    // Pausar monitoreo si está viendo otras páginas
    if (localStorage.getItem('pause_monitoring') === 'true') {
        return;
    }

    try {
        const blob = await captureFrame();
        
        if (!blob) {
            console.warn("No se pudo capturar frame para monitoreo");
            return;
        }

        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${API}/face/recognize/check`, {
            method: "POST",
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }

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

        // Verificar timeout - DESACTIVADO
        // const timeSince = Date.now() - lastDetectionTime;
        // if (timeSince >= SESSION_TIMEOUT) {
        //     console.log("⏱️ Timeout - cerrando sesión");
        //     alert("Sesión cerrada: no se detectó tu presencia por más de 10 segundos");
        //     await endSession();
        // } else {
        //     const remaining = Math.ceil((SESSION_TIMEOUT - timeSince) / 1000);
        //     console.log(`⚠️ No detectado (${remaining}s)`);
            
        //     const indicator = document.getElementById("presenceIndicator");
        //     if (indicator) {
        //         indicator.textContent = `⚠ Sin presencia (${remaining}s)`;
        //         indicator.className = "presence-indicator presence-warning";
        //     }
        // }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error("Timeout en monitoreo de presencia");
        } else {
            console.error("Error en checkPresence:", error);
        }
    }
}

// ===============================
// Modo Activo - MONITOREO
// ===============================
async function startActiveMode() {
    console.log("🟢 Iniciando modo activo...");
    
    // Recuperar datos de sessionStorage
    currentSessionId = sessionStorage.getItem("session_id");
    currentUser = sessionStorage.getItem("username");

    if (!currentSessionId || !currentUser) {
        console.error("❌ No hay datos de sesión");
        alert("No se encontraron datos de sesión. Redirigiendo al login...");
        window.location.href = "/static/account/login.html";
        return;
    }

    console.log(`🟢 Modo activo: ${currentUser} (sesión ${currentSessionId})`);
    
    // Mostrar nombre de usuario
    const welcomeEl = document.getElementById("welcome");
    if (welcomeEl) {
        welcomeEl.textContent = `Bienvenido, ${currentUser}`;
    }

    // Verificar backend
    const backendOk = await checkBackendHealth();
    if (!backendOk) {
        alert("No se puede conectar con el servidor. El monitoreo de presencia no funcionará.");
        return;
    }

    // Iniciar cámara para monitoreo
    try {
        await initCamera();
        lastDetectionTime = Date.now();
        
        // Iniciar monitoreo cada 2 segundos
        presenceCheckInterval = setInterval(() => {
            checkPresence();
        }, PRESENCE_CHECK_INTERVAL);
        
        console.log("👁️ Monitoreo de presencia activado");
    } catch (error) {
        alert("No se pudo inicializar la cámara para el monitoreo de presencia.");
    }
}

// ===============================
// Ir a registro
// ===============================
function goRegister() {
    stopEverything();
    window.location.href = "/static/account/register.html";
}