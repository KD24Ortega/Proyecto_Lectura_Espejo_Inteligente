// =====================================================
//  SISTEMA DE RECOMENDACIONES INTELIGENTES v2.0
//  Recomienda ejercicios basados en PHQ-9 y GAD-7
//  SIN DUPLICADOS
// =====================================================

/**
 * Catálogo de ejercicios disponibles
 */
export const EXERCISES_CATALOG = {
  anxiety: [
    {
      id: 'breathing-vocalization',
      title: 'Respiración con Vocalización',
      description: 'Técnica de respiración guiada con sonidos vocales para calmar tu sistema nervioso',
      duration: '5 minutos',
      icon: '🫁',
      route: '/anxiety/breathing-vocalization',
      type: 'anxiety',
      priority: 1,
      tags: ['respiración', 'calma', 'inmediato']
    },
    {
      id: 'conscious-reading',
      title: 'Lectura Consciente',
      description: 'Frases tranquilizadoras que te ayudan a centrarte en el momento presente',
      duration: '6 minutos',
      icon: '📖',
      route: '/anxiety/conscious-reading',
      type: 'anxiety',
      priority: 2,
      tags: ['mindfulness', 'concentración', 'calma']
    },
    {
      id: 'vocal-practice',
      title: 'Práctica Vocal',
      description: 'Ejercicios de voz y canto para liberar tensión y activar energía positiva',
      duration: '7 minutos',
      icon: '🎤',
      route: '/anxiety/vocal-practice',
      type: 'anxiety',
      priority: 3,
      tags: ['energía', 'expresión', 'liberación']
    }
  ],
  depression: [
    {
      id: 'prosodic-reading',
      title: 'Lectura Prosódica',
      description: 'Ejercicios de lectura con pausas y entonación para mejorar la expresión vocal',
      duration: '8 minutos',
      icon: '📚',
      route: '/depression/prosodic-reading',
      type: 'depression',
      priority: 1,
      tags: ['expresión', 'emoción', 'activación']
    },
    {
      id: 'vocal-affirmations',
      title: 'Afirmaciones Vocales',
      description: 'Frases positivas para fortalecer tu autoestima y confianza personal',
      duration: '6 minutos',
      icon: '💪',
      route: '/depression/vocal-affirmations',
      type: 'depression',
      priority: 2,
      tags: ['autoestima', 'positividad', 'confianza']
    },
    {
      id: 'guided-dialogue',
      title: 'Diálogo Guiado',
      description: 'Preguntas reflexivas para conectar con tus emociones y pensamientos positivos',
      duration: '10 minutos',
      icon: '💭',
      route: '/depression/guided-dialogue',
      type: 'depression',
      priority: 3,
      tags: ['reflexión', 'autoconocimiento', 'gratitud']
    }
  ]
};

/**
 * Determina el perfil emocional basado en scores PHQ-9 y GAD-7
 */
export function getEmotionalProfile(phq9Score, gad7Score) {
  if (phq9Score === null || gad7Score === null) {
    return {
      profile: 'sin_evaluacion',
      severity: 'none',
      primaryCondition: null,
      recommendationStrategy: 'mixed'
    };
  }

  const depressionSeverity = classifyDepression(phq9Score);
  const anxietySeverity = classifyAnxiety(gad7Score);

  const diff = Math.abs(phq9Score - gad7Score);
  const threshold = 3;

  let profile, primaryCondition, recommendationStrategy;

  if (diff < threshold) {
    profile = 'mixed';
    primaryCondition = 'both';
    recommendationStrategy = 'balanced';
  } else if (phq9Score > gad7Score) {
    profile = 'depression_dominant';
    primaryCondition = 'depression';
    recommendationStrategy = 'depression_focused';
  } else {
    profile = 'anxiety_dominant';
    primaryCondition = 'anxiety';
    recommendationStrategy = 'anxiety_focused';
  }

  return {
    profile,
    severity: {
      depression: depressionSeverity,
      anxiety: anxietySeverity,
      overall: getOverallSeverity(depressionSeverity, anxietySeverity)
    },
    primaryCondition,
    recommendationStrategy,
    scores: { phq9: phq9Score, gad7: gad7Score }
  };
}

function classifyDepression(score) {
  if (score < 5) return 'minimal';
  if (score < 10) return 'mild';
  if (score < 15) return 'moderate';
  if (score < 20) return 'moderately_severe';
  return 'severe';
}

function classifyAnxiety(score) {
  if (score < 5) return 'minimal';
  if (score < 10) return 'mild';
  if (score < 15) return 'moderate';
  return 'severe';
}

function getOverallSeverity(depSeverity, anxSeverity) {
  const severityLevels = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe'];
  const depIndex = severityLevels.indexOf(depSeverity);
  const anxIndex = severityLevels.indexOf(anxSeverity);
  const maxIndex = Math.max(depIndex, anxIndex);
  return severityLevels[maxIndex];
}

/**
 * Genera recomendaciones inteligentes de ejercicios SIN DUPLICADOS
 */
export function getRecommendations(phq9Score, gad7Score, options = {}) {
  const {
    maxRecommendations = 3,
    includeAllExercises = false
  } = options;

  const profile = getEmotionalProfile(phq9Score, gad7Score);
  
  // Si no hay evaluación, mostrar todos aleatoriamente
  if (profile.profile === 'sin_evaluacion') {
    const allExercises = [
      ...EXERCISES_CATALOG.anxiety,
      ...EXERCISES_CATALOG.depression
    ];
    return shuffleArray(allExercises).slice(0, maxRecommendations);
  }

  const { recommendationStrategy, severity } = profile;
  
  let recommendations = [];

  // Estrategia basada en el perfil
  switch (recommendationStrategy) {
    case 'anxiety_focused':
      // 70% ansiedad, 30% depresión
      recommendations = [
        ...selectExercises(EXERCISES_CATALOG.anxiety, 2, severity.anxiety),
        ...selectExercises(EXERCISES_CATALOG.depression, 1, severity.depression)
      ];
      break;

    case 'depression_focused':
      // 70% depresión, 30% ansiedad
      recommendations = [
        ...selectExercises(EXERCISES_CATALOG.depression, 2, severity.depression),
        ...selectExercises(EXERCISES_CATALOG.anxiety, 1, severity.anxiety)
      ];
      break;

    case 'balanced':
    default:
      // 50/50 - Mezcla equilibrada SIN DUPLICADOS
      const anxietyExercise = selectExercises(EXERCISES_CATALOG.anxiety, 1, severity.anxiety);
      const depressionExercise = selectExercises(EXERCISES_CATALOG.depression, 1, severity.depression);
      
      // Para el tercero, obtener ejercicios que NO estén ya seleccionados
      const usedIds = new Set([
        ...anxietyExercise.map(e => e.id),
        ...depressionExercise.map(e => e.id)
      ]);
      
      // Obtener todos los ejercicios no usados
      const allUnusedExercises = [
        ...EXERCISES_CATALOG.anxiety.filter(e => !usedIds.has(e.id)),
        ...EXERCISES_CATALOG.depression.filter(e => !usedIds.has(e.id))
      ];
      
      // Seleccionar uno aleatorio de los no usados
      const thirdExercise = shuffleArray(allUnusedExercises).slice(0, 1);
      
      recommendations = [
        ...anxietyExercise,
        ...depressionExercise,
        ...thirdExercise
      ];
      break;
  }

  // Eliminar duplicados por seguridad adicional
  recommendations = removeDuplicates(recommendations);

  // Mezclar para variedad
  recommendations = shuffleArray(recommendations);

  return recommendations.slice(0, maxRecommendations);
}

/**
 * Elimina ejercicios duplicados basándose en el ID
 */
function removeDuplicates(exercises) {
  const seen = new Set();
  return exercises.filter(exercise => {
    if (seen.has(exercise.id)) {
      return false;
    }
    seen.add(exercise.id);
    return true;
  });
}

/**
 * Selecciona ejercicios priorizando por severidad
 */
function selectExercises(exerciseList, count, severity) {
  // Copiar y ordenar por prioridad
  let exercises = [...exerciseList].sort((a, b) => a.priority - b.priority);
  
  // Si severidad es alta, priorizar ejercicios de alta prioridad
  if (severity === 'severe' || severity === 'moderately_severe') {
    return exercises.slice(0, count);
  } else {
    // Mezclar para variedad
    exercises = shuffleArray(exercises);
    return exercises.slice(0, count);
  }
}

/**
 * Mezcla un array aleatoriamente (Fisher-Yates)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Genera mensaje personalizado basado en el perfil
 */
export function getPersonalizedMessage(phq9Score, gad7Score) {
  const profile = getEmotionalProfile(phq9Score, gad7Score);

  const messages = {
    sin_evaluacion: {
      title: '¡Hola! 👋',
      message: 'Completa los tests PHQ-9 y GAD-7 para recibir recomendaciones personalizadas de ejercicios.',
      emoji: '📋',
      color: 'blue'
    },
    anxiety_dominant: {
      title: 'Momento de Calma 🧘',
      message: 'Hemos notado que podrías beneficiarte de ejercicios de relajación. ¿Qué tal si pruebas alguna técnica de respiración?',
      emoji: '🫁',
      color: 'blue'
    },
    depression_dominant: {
      title: 'Activa tu Energía ⚡',
      message: 'Los ejercicios de expresión vocal pueden ayudarte a elevar tu ánimo. ¿Comenzamos con algunas afirmaciones positivas?',
      emoji: '💪',
      color: 'amber'
    },
    mixed: {
      title: 'Equilibrio Emocional 🌈',
      message: 'Te recomendamos una combinación de ejercicios de calma y activación para encontrar tu equilibrio.',
      emoji: '⚖️',
      color: 'purple'
    }
  };

  return messages[profile.profile] || messages.sin_evaluacion;
}

/**
 * Determina cuándo mostrar notificaciones
 */
export function shouldShowNotification(lastShown, intervalMinutes = 30) {
  if (!lastShown) return true;
  
  const now = new Date().getTime();
  const diff = now - lastShown;
  const minInMs = intervalMinutes * 60 * 1000;
  
  return diff >= minInMs;
}