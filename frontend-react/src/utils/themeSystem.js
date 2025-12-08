// Sistema de temas basado en PHQ-9 y GAD-7

export const getEmotionalState = (phq9Score, gad7Score) => {
  // Sin tests
  if (phq9Score === null && gad7Score === null) {
    return 'sin_evaluacion';
  }

  // Clasificación de depresión (PHQ-9)
  const depressionLevel = 
    phq9Score === null ? 'sin_test' :
    phq9Score < 5 ? 'minima' :
    phq9Score < 10 ? 'leve' :
    phq9Score < 15 ? 'moderada' :
    'severa';

  // Clasificación de ansiedad (GAD-7)
  const anxietyLevel = 
    gad7Score === null ? 'sin_test' :
    gad7Score < 5 ? 'minima' :
    gad7Score < 10 ? 'leve' :
    gad7Score < 15 ? 'moderada' :
    'severa';

  // Emergencia
  if (phq9Score >= 15 && gad7Score >= 15) {
    return 'emergencia';
  }

  // Depresión severa
  if (phq9Score >= 15) {
    return 'depresion_severa';
  }

  // Ansiedad severa
  if (gad7Score >= 15) {
    return 'ansiedad_severa';
  }

  // Dual moderado
  if (phq9Score >= 10 && gad7Score >= 10) {
    return 'dual_moderado';
  }

  // Moderado individual
  if (phq9Score >= 10 || gad7Score >= 10) {
    return phq9Score >= 10 ? 'depresion_moderada' : 'ansiedad_moderada';
  }

  // Leve
  if (phq9Score >= 5 || gad7Score >= 5) {
    return 'leve';
  }

  // Estable
  return 'estable';
};

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
    tools: ['Intro', 'Botones de test'],
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
    music: 'https://www.bensound.com/bensound-music/bensound-relaxing.mp3',
    tools: ['Consejos de bienestar', 'Meditación preventiva'],
    emergency: false
  },

  leve: {
    name: 'Ansiedad/Depresión Leve',
    colors: {
      primary: 'from-sky-200 via-blue-300 to-blue-400',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-blue-600',
      button: 'from-blue-400 to-blue-500'
    },
    music: 'https://www.bensound.com/bensound-music/bensound-slowmotion.mp3',
    tools: ['Respiración básica', 'Gratitud', 'Autocuidado'],
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
    music: 'https://www.bensound.com/bensound-music/bensound-deepblue.mp3',
    tools: ['Mindfulness', 'Respiración 4-7-8', 'Técnicas de grounding'],
    emergency: false
  },

  depresion_moderada: {
    name: 'Depresión Moderada',
    colors: {
      primary: 'from-blue-500 via-indigo-500 to-blue-600',
      card: 'bg-white/95',
      text: 'text-gray-800',
      accent: 'text-indigo-600',
      button: 'from-indigo-500 to-blue-600'
    },
    music: 'https://www.bensound.com/bensound-music/bensound-clearday.mp3',
    tools: ['Meditación', 'Relajación', 'Activación conductual'],
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
    music: 'https://www.bensound.com/bensound-music/bensound-pianomoment.mp3',
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
    music: 'https://www.bensound.com/bensound-music/bensound-relaxing.mp3',
    tools: ['PFA', 'Respiración guiada', 'Técnicas de emergencia'],
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
    music: 'https://www.bensound.com/bensound-music/bensound-slowmotion.mp3',
    tools: ['PFA intensivo', 'Contacto de emergencia'],
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
    music: 'https://www.bensound.com/bensound-music/bensound-relaxing.mp3',
    tools: ['🚨 LÍNEA 952', 'PFA Emergencia'],
    emergency: true,
    emergencyNumber: '952'
  }
};

export const getTheme = (emotionalState) => {
  return themes[emotionalState] || themes.sin_evaluacion;
};