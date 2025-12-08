import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import FaceMonitor from '../components/FaceMonitor'; // ← Al inicio

function PHQ9() {
  const navigate = useNavigate();
  
  // Estados principales
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de voz - Text to Speech
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Estados de voz - Speech to Text
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [showVoiceConfirm, setShowVoiceConfirm] = useState(false);
  const [detectedAnswer, setDetectedAnswer] = useState(null);
  
  const recognitionRef = useRef(null);

  useEffect(() => {
    loadQuestions();
    initSpeechRecognition();
  }, []);

  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/phq9/questions');
      setQuestions(response.data.questions);
      setAnswers(new Array(response.data.questions.length).fill(null));
      setIsLoading(false);
    } catch (error) {
      console.error('Error al cargar preguntas:', error);
      alert('Error al cargar el test');
      setIsLoading(false);
    }
  };

  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setVoiceTranscript('Escuchando...');
        setShowVoiceConfirm(false);
      };

      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceTranscript(`Escuche: "${transcript}"`);
        
        try {
          const response = await api.post(`/voice/map-response?text=${encodeURIComponent(transcript)}`);
          const score = response.data.score;
          
          const answerLabels = ['Ningun dia', 'Varios dias', 'Mas de la mitad de los dias', 'Casi todos los dias'];
          setDetectedAnswer({ score, label: answerLabels[score] });
          setShowVoiceConfirm(true);
        } catch (error) {
          console.error('Error al mapear respuesta:', error);
          setVoiceTranscript('No entendi. Intenta de nuevo.');
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Error de reconocimiento:', event.error);
        setIsListening(false);
        setVoiceTranscript('Error al escuchar. Intenta de nuevo.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  const speakQuestion = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const questionText = `Pregunta ${currentQuestion + 1} de ${questions.length}. Durante las ultimas 2 semanas, con que frecuencia has sentido: ${questions[currentQuestion]}`;
      
      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Tu navegador no soporta sintesis de voz');
    }
  };

  const startVoiceRecognition = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error al iniciar reconocimiento:', error);
    }
  };

  const handleClickAnswer = (value) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
  };

  const confirmVoiceAnswer = () => {
    if (detectedAnswer !== null) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = detectedAnswer.score;
      setAnswers(newAnswers);
      setShowVoiceConfirm(false);
      setVoiceTranscript('');
      setDetectedAnswer(null);
    }
  };

  const retryVoice = () => {
    setVoiceTranscript('');
    setShowVoiceConfirm(false);
    setDetectedAnswer(null);
  };

  const handleNext = () => {
    if (answers[currentQuestion] === null) {
      alert('Por favor selecciona una respuesta');
      return;
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setVoiceTranscript('');
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
    } else {
      submitTest();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setVoiceTranscript('');
      setShowVoiceConfirm(false);
      setDetectedAnswer(null);
    }
  };

  const submitTest = async () => {
    try {
      const userId = localStorage.getItem('user_id') || 1;
      
      const response = await api.post('/phq9/submit', {
        user_id: parseInt(userId),
        responses: answers
      });

      // Guardar en localStorage
      localStorage.setItem('last_test_type', 'phq9');
      localStorage.setItem('last_phq9_score', response.data.score);
      localStorage.setItem('last_phq9_severity', response.data.severity);

      // Navegar a resultados con state
      navigate('/results', { 
        state: { 
          type: 'phq9',
          score: response.data.score, 
          severity: response.data.severity 
        } 
      });
    } catch (error) {
      console.error('Error al enviar test:', error);
      alert('Error al procesar tus respuestas. Intenta de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-2xl font-semibold text-gray-700">Cargando test...</div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const answerOptions = [
    { value: 0, label: 'Ningun dia', emoji: '😊' },
    { value: 1, label: 'Varios dias', emoji: '😐' },
    { value: 2, label: 'Mas de la mitad de los dias', emoji: '😟' },
    { value: 3, label: 'Casi todos los dias', emoji: '😢' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 md:p-6">
        {/* ✅ Monitor durante el test */}
      <FaceMonitor isActive={true} />
      <div className="max-w-2xl mx-auto">
        
        {/* Header - Numero 1 del diseño */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/home')}
            className="text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2 transition-colors"
          >
            <span className="text-xl">×</span>
            <span>Salir</span>
          </button>
          
          <div className="bg-red-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg">
            PHQ-9
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8">
          
          {/* Numero 2: Indicador de Progreso */}
          <div className="mb-8">
            {/* Texto y porcentaje */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-semibold text-gray-700">
                Pregunta {currentQuestion + 1} de {questions.length}
              </span>
            </div>
            
            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
              <div 
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            {/* Puntos indicadores */}
            <div className="flex justify-between gap-1">
              {questions.map((_, index) => (
                <div 
                  key={index}
                  className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                    index < currentQuestion ? 'bg-green-500' :
                    index === currentQuestion ? 'bg-blue-500' : 
                    'bg-gray-300'
                  }`}
                ></div>
              ))}
            </div>
          </div>

          {/* Numero 3: Pregunta del Test con boton de voz */}
          <div className="mb-8">
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <p className="text-sm text-gray-600 mb-3">
                Durante las ultimas 2 semanas, con que frecuencia has sentido...
              </p>
              
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800 leading-snug">
                    {questions[currentQuestion]}
                  </h2>
                </div>
                
                <button
                  onClick={speakQuestion}
                  disabled={isSpeaking}
                  className={`flex-shrink-0 p-3 rounded-full transition-all ${
                    isSpeaking 
                      ? 'bg-blue-300 scale-110' 
                      : 'bg-blue-100 hover:bg-blue-200 hover:scale-110'
                  }`}
                  title="Escuchar pregunta"
                >
                  <span className="text-2xl">{isSpeaking ? '🔊' : '🔉'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Numero 4: Opciones de Respuesta */}
          <div className="space-y-3 mb-6">
            {answerOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleClickAnswer(option.value)}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-300 flex items-center justify-between group ${
                  answers[currentQuestion] === option.value
                    ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:scale-[1.01]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{option.emoji}</span>
                  <span className={`font-semibold ${
                    answers[currentQuestion] === option.value 
                      ? 'text-blue-700' 
                      : 'text-gray-700'
                  }`}>
                    {option.label}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${
                  answers[currentQuestion] === option.value 
                    ? 'text-blue-600' 
                    : 'text-gray-400 group-hover:text-gray-600'
                }`}>
                  {option.value}
                </div>
              </button>
            ))}
          </div>

          {/* Numero 5: Respuesta por Voz */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-purple-200">
              
              {!showVoiceConfirm ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🎙️</span>
                      <p className="text-sm font-bold text-purple-900">
                        O responde con tu voz
                      </p>
                    </div>
                    <p className="text-xs text-purple-700 mb-2">
                      Di: cero, uno, dos o tres
                    </p>
                    {voiceTranscript && !showVoiceConfirm && (
                      <p className="text-sm text-purple-800 italic bg-white/50 px-3 py-2 rounded-lg">
                        {voiceTranscript}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={startVoiceRecognition}
                    disabled={isListening}
                    className={`flex-shrink-0 p-4 rounded-full transition-all shadow-lg ${
                      isListening
                        ? 'bg-red-500 animate-pulse scale-110'
                        : 'bg-purple-500 hover:bg-purple-600 hover:scale-110'
                    } text-white`}
                  >
                    <span className="text-2xl">{isListening ? '🎤' : '🎙️'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white/70 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-2">Tu respuesta detectada:</p>
                    <p className="text-lg font-bold text-purple-900">
                      {detectedAnswer.score} - {detectedAnswer.label}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={confirmVoiceAnswer}
                      className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <span>✓</span> Confirmar
                    </button>
                    <button
                      onClick={retryVoice}
                      className="flex-1 px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <span>🔄</span> Repetir
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Numeros 6 y 7: Botones de Navegacion */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <button
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                currentQuestion === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:shadow-md'
              }`}
            >
              <span>←</span> Anterior
            </button>

            <button
              onClick={handleNext}
              disabled={answers[currentQuestion] === null}
              className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                answers[currentQuestion] === null
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
              }`}
            >
              {currentQuestion === questions.length - 1 ? 'Finalizar' : 'Siguiente'} 
              <span>→</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

export default PHQ9;