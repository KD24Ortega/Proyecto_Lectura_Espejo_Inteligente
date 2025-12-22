import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { getEmotionalState, getTheme } from "../utils/themeSystem";

export default function useDynamicTheme() {
  const [theme, setTheme] = useState(getTheme("sin_evaluacion"));
  const [isThemeLoading, setIsThemeLoading] = useState(true);
  const [scores, setScores] = useState({ phq9: null, gad7: null });
  const [voiceRisk, setVoiceRisk] = useState("LOW");
  const [emotionalState, setEmotionalState] = useState("sin_evaluacion");

  const loadThemeFromLastScores = useCallback(async () => {
    try {
      const storedUserId = localStorage.getItem("user_id");

      if (!storedUserId) {
        setScores({ phq9: null, gad7: null });
        setVoiceRisk("LOW");
        setEmotionalState("sin_evaluacion");
        setTheme(getTheme("sin_evaluacion"));
        return;
      }

      try {
        const [assessmentsRes] = await Promise.all([
          api.get(`/assessments/last/${storedUserId}`),
        ]);

        const phq9Score = assessmentsRes?.data?.phq9?.score ?? null;
        const gad7Score = assessmentsRes?.data?.gad7?.score ?? null;

        setScores({ phq9: phq9Score, gad7: gad7Score });
        // Fondo SOLO basado en tests (PHQ-9 / GAD-7). No se usa análisis de voz.
        const risk = "LOW";
        setVoiceRisk(risk);

        const state = getEmotionalState(phq9Score, gad7Score, risk);
        setEmotionalState(state);
        setTheme(getTheme(state));
      } catch (err) {
        console.error("Error al cargar scores (theme):", err);
        setScores({ phq9: null, gad7: null });
        setVoiceRisk("LOW");
        setEmotionalState("sin_evaluacion");
        setTheme(getTheme("sin_evaluacion"));
      }
    } catch (error) {
      console.error("Error al cargar theme:", error);
      setScores({ phq9: null, gad7: null });
      setVoiceRisk("LOW");
      setEmotionalState("sin_evaluacion");
      setTheme(getTheme("sin_evaluacion"));
    } finally {
      setIsThemeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemeFromLastScores();
  }, [loadThemeFromLastScores]);

  return {
    theme,
    isThemeLoading,
    reloadTheme: loadThemeFromLastScores,
    scores,
    voiceRisk,
    emotionalState,
  };
}
