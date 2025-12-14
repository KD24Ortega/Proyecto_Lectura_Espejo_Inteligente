// =====================================================
// SISTEMA DE TEMAS MULTIMODAL
// Basado en PHQ-9, GAD-7 y Riesgo Vocal
// =====================================================

// voiceRisk: 'LOW' | 'MODERATE' | 'HIGH'
export const getEmotionalState = (phq9Score, gad7Score, voiceRisk = 'LOW') => {

  // ---------------------------------
  // SIN EVALUACIÓN
  // ---------------------------------
  if (phq9Score === null && gad7Score === null) {
    return 'sin_evaluacion';
  }

  // Normalizar
  const phq = phq9Score ?? 0;
  const gad = gad7Score ?? 0;
  const risk = (voiceRisk || 'LOW').toUpperCase();

  // ---------------------------------
  // 🚨 EMERGENCIA MULTIMODAL
  // ---------------------------------
  if (
    (phq >= 15 && gad >= 15) ||
    (risk === 'HIGH' && (phq >= 15 || gad >= 15))
  ) {
    return 'emergencia';
  }

  // ---------------------------------
  // SEVERO (voz prioriza riesgo)
  // ---------------------------------
  if (risk === 'HIGH') {
    if (phq >= 10) return 'depresion_severa';
    if (gad >= 10) return 'ansiedad_severa';
  }

  if (phq >= 15) return 'depresion_severa';
  if (gad >= 15) return 'ansiedad_severa';

  // ---------------------------------
  // MODERADO MULTIMODAL
  // ---------------------------------
  if (phq >= 10 && gad >= 10) return 'dual_moderado';

  if (risk === 'MODERATE') {
    if (phq >= 5 || gad >= 5) {
      return 'dual_moderado';
    }
  }

  if (phq >= 10) return 'depresion_moderada';
  if (gad >= 10) return 'ansiedad_moderada';

  // ---------------------------------
  // LEVE
  // ---------------------------------
  if (phq >= 5 || gad >= 5) {
    return 'leve';
  }

  // ---------------------------------
  // ESTABLE
  // ---------------------------------
  return 'estable';
};

// =====================================================
// DEFINICIÓN DE TEMAS VISUALES
// =====================================================

export const themes = {

  sin_evaluacion: {
    name: 'Sin evaluación',
    colors: {
      primary: 'from-gray-400 via-gray-500 to-slate-600',
      card: 'bg-white/90',
      text: 'text-gray-800',
      accent: 'text-blue-600',
      button: 'from-blue-500 to-blue-600'
    },
    music: null,
    tools: ['Intro', 'Evaluaciones iniciales'],
    emergency: false
  },

  estable: {
    name: 'Estable',
    colors: {
      primary: 'from-green-300 via-cyan-300 to-blue-400',
      card: 'bg-white/90',
      text: 'text-gray-800',
      accent: 'text-green-600',
      button: 'from-green-500 to-cyan-500'
    },
    music: 'https://cdn.pixabay.com/audio/2022/10/01/audio_784b40f9f6.mp3',
    tools: ['Bienestar', 'Prevención'],
    emergency: false
  },

  leve: {
    name: 'Ansiedad / Depresión Leve',
    colors: {
      primary: 'from-sky-200 via-blue-300 to-blue-400',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-blue-600',
      button: 'from-blue-400 to-blue-500'
    },
    music: 'https://cdn.pixabay.com/audio/2021/08/19/audio_a817080ba3.mp3',
    tools: ['Respiración', 'Autocuidado'],
    emergency: false
  },

  ansiedad_moderada: {
    name: 'Ansiedad Moderada',
    colors: {
      primary: 'from-blue-400 via-blue-500 to-blue-600',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-blue-700',
      button: 'from-blue-500 to-blue-600'
    },
    music: 'https://cdn.pixabay.com/audio/2022/03/09/audio_5ffca7b9d1.mp3',
    tools: ['Mindfulness', 'Grounding'],
    emergency: false
  },

  depresion_moderada: {
    name: 'Depresión Moderada',
    colors: {
      primary: 'from-indigo-400 via-indigo-500 to-indigo-600',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-indigo-600',
      button: 'from-indigo-500 to-blue-600'
    },
    music: 'https://cdn.pixabay.com/audio/2025/07/17/audio_5925f8939b.mp3',
    tools: ['Activación conductual', 'Motivación'],
    emergency: false
  },

  dual_moderado: {
    name: 'Ansiedad y Depresión Moderadas',
    colors: {
      primary: 'from-blue-600 via-indigo-600 to-slate-700',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-indigo-700',
      button: 'from-indigo-600 to-blue-700'
    },
    music: 'https://cdn.pixabay.com/audio/2023/11/17/audio_e7cee3c166.mp3',
    tools: ['Mindfulness completo', 'Autocuidado intensivo'],
    emergency: false
  },

  ansiedad_severa: {
    name: 'Ansiedad Severa',
    colors: {
      primary: 'from-blue-700 via-slate-700 to-slate-800',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-orange-600',
      button: 'from-orange-500 to-red-500'
    },
    music: 'https://cdn.pixabay.com/audio/2021/08/27/audio_f52b2b0ead.mp3',
    tools: ['Respiración guiada', 'Emergencia'],
    emergency: true
  },

  depresion_severa: {
    name: 'Depresión Severa',
    colors: {
      primary: 'from-slate-700 via-slate-800 to-gray-900',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-orange-600',
      button: 'from-orange-500 to-red-500'
    },
    music: 'https://cdn.pixabay.com/audio/2024/03/25/audio_b94d4bae8c.mp3',
    tools: ['Apoyo profesional', 'Emergencia'],
    emergency: true
  },

  emergencia: {
    name: '🚨 ALTO RIESGO',
    colors: {
      primary: 'from-red-900 via-slate-900 to-black',
      card: 'bg-red-50/95 border-4 border-red-500',
      text: 'text-gray-900',
      accent: 'text-red-700',
      button: 'from-red-600 to-red-700'
    },
    music: null,
    tools: ['🚨 Línea 171 opción 6', 'PFA'],
    emergency: true,
    emergencyNumber: '171 opción 6'
  }
};

// =====================================================
// OBTENER TEMA
// =====================================================
export const getTheme = (emotionalState) => {
  return themes[emotionalState] || themes.sin_evaluacion;
};
