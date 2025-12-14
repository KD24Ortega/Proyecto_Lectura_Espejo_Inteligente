import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { getEmotionalState, getTheme } from "../utils/themeSystem";

export default function useDynamicTheme() {
  const [theme, setTheme] = useState(getTheme("sin_evaluacion"));
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  const loadThemeFromLastScores = useCallback(async () => {
    try {
      const storedUserId = localStorage.getItem("user_id");

      if (!storedUserId) {
        setTheme(getTheme("sin_evaluacion"));
        return;
      }

      try {
        const response = await api.get(`/assessments/last/${storedUserId}`);

        const phq9Score = response?.data?.phq9?.score ?? null;
        const gad7Score = response?.data?.gad7?.score ?? null;

        const state = getEmotionalState(phq9Score, gad7Score);
        setTheme(getTheme(state));
      } catch (err) {
        console.error("Error al cargar scores (theme):", err);
        setTheme(getTheme("sin_evaluacion"));
      }
    } catch (error) {
      console.error("Error al cargar theme:", error);
      setTheme(getTheme("sin_evaluacion"));
    } finally {
      setIsThemeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemeFromLastScores();
  }, [loadThemeFromLastScores]);

  return { theme, isThemeLoading, reloadTheme: loadThemeFromLastScores };
}
