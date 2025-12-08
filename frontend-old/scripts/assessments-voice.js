const API_URL = 'http://127.0.0.1:8000';
const userId = sessionStorage.getItem('user_id');

let currentTest = null;
let questions = [];
let currentQuestionIndex = 0;
let responses = [];
let mediaRecorder = null;
let audioChunks = [];
let recordedAudio = null;

// Iniciar test
async function startTest(testType) {
    currentTest = testType;
    responses = [];
    currentQuestionIndex = 0;
    
    // Cargar preguntas
    const endpoint = testType === 'phq9' ? '/phq9/questions' : '/gad7/questions';
    const res = await fetch(API_URL + endpoint);
    const data = await res.json();
    questions = data.questions;
    
    document.querySelector('.test-selector').classList.add('hidden');
    document.getElementById('test-container').classList.remove('hidden');
    document.getElementById('test-title').textContent = testType === 'phq9' ? 'PHQ-9 (Depresión)' : 'GAD-7 (Ansiedad)';
    document.getElementById('total-q').textContent = questions.length;
    
    showQuestion();
}

// Mostrar pregunta
function showQuestion() {
    if (currentQuestionIndex >= questions.length) {
        submitTest();
        return;
    }
    
    const question = questions[currentQuestionIndex];
    document.getElementById('question-text').textContent = question;
    document.getElementById('current-q').textContent = currentQuestionIndex + 1;
    
    // Resetear opciones
    document.getElementById('transcription').textContent = '';
    document.getElementById('voice-confirm').classList.add('hidden');
    
    updateMode();
}

// Cambiar modo (clic/voz)
function updateMode() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    if (mode === 'click') {
        document.getElementById('click-options').classList.remove('hidden');
        document.getElementById('voice-options').classList.add('hidden');
    } else {
        document.getElementById('click-options').classList.add('hidden');
        document.getElementById('voice-options').classList.remove('hidden');
    }
}

document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', updateMode);
});

// Responder con clic
function selectAnswer(score) {
    responses.push(score);
    currentQuestionIndex++;
    showQuestion();
}

// Dictar pregunta
async function speakQuestion() {
    const question = questions[currentQuestionIndex];
    const audio = new Audio(`${API_URL}/voice/speak/${encodeURIComponent(question)}`);
    audio.play();
}

// Grabar voz
async function toggleRecording() {
    const btn = document.getElementById('record-btn');
    
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        // Iniciar grabación
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            recordedAudio = audioBlob;
            await transcribeAudio(audioBlob);
        };
        
        mediaRecorder.start();
        btn.textContent = '⏺️ Grabando... (Suelta para detener)';
        btn.classList.add('recording');
        
    } else {
        // Detener grabación
        mediaRecorder.stop();
        btn.textContent = '🎤 Mantén presionado para hablar';
        btn.classList.remove('recording');
    }
}

// Transcribir audio
async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    
    try {
        const res = await fetch(`${API_URL}/voice/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        // Verificar si la respuesta es exitosa
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Error del servidor:', errorText);
            alert('Error en el servidor. Ver consola.');
            return;
        }
        
        const data = await res.json();
        
        if (!data.text) {
            alert('No se pudo transcribir el audio. Intenta hablar más claro.');
            return;
        }
        
        document.getElementById('transcription').textContent = `Escuché: "${data.text}"`;
        
        // Mapear a puntuación
        const mapRes = await fetch(`${API_URL}/voice/map-response?text=${encodeURIComponent(data.text)}`, {
            method: 'POST'
        });
        
        const mapData = await mapRes.json();
        
        const answers = ['Nada', 'Varios días', 'Más de la mitad', 'Casi todos los días'];
        document.getElementById('detected-answer').textContent = `${mapData.score} - ${answers[mapData.score]}`;
        document.getElementById('voice-confirm').classList.remove('hidden');
        
        recordedAudio = { blob: audioBlob, score: mapData.score };
        
    } catch (error) {
        alert('Error al transcribir: ' + error.message);
    }
}

// Confirmar respuesta por voz
function confirmVoiceAnswer() {
    responses.push(recordedAudio.score);
    currentQuestionIndex++;
    showQuestion();
}

// Repetir grabación
function retryVoice() {
    document.getElementById('transcription').textContent = '';
    document.getElementById('voice-confirm').classList.add('hidden');
    recordedAudio = null;
}

// Enviar test
async function submitTest() {
    const endpoint = currentTest === 'phq9' ? '/phq9/submit' : '/gad7/submit';
    
    const res = await fetch(API_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: parseInt(userId),
            responses: responses
        })
    });
    
    const result = await res.json();
    
    // Analizar voz si se grabó algo
    if (recordedAudio && recordedAudio.blob) {
        const formData = new FormData();
        formData.append('file', recordedAudio.blob, 'voice.wav');
        
        await fetch(`${API_URL}/voice/analyze?user_id=${userId}`, {
            method: 'POST',
            body: formData
        });
    }
    
    showResults(result);
}

// Mostrar resultados
function showResults(result) {
    document.getElementById('test-container').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
    
    document.getElementById('score-display').innerHTML = `
        <h3>Puntuación: ${result.score}</h3>
        <p>Severidad: ${result.severity}</p>
    `;
}