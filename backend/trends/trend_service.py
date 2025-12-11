from sqlalchemy.orm import Session
from backend.db import models
from datetime import datetime, timedelta
import numpy as np
from typing import Tuple, Dict, List

# ============================================================
# CONFIGURACIÓN DE UMBRALES
# ============================================================
TREND_THRESHOLDS = {
    "improving_strong": -1.5,    # Mejora significativa
    "improving": -0.5,           # Mejora leve
    "stable_upper": 0.5,         # Estable
    "worsening": 1.5,            # Empeorando leve
    "worsening_strong": float('inf')  # Empeorando crítico
}

SCORE_THRESHOLDS = {
    "excellent": 80,
    "good": 60,
    "moderate": 40,
    "concerning": 20,
    "critical": 0
}

# Pesos para PHQ-9 y GAD-7 (ajustables según prioridad clínica)
WEIGHTS = {
    "phq9": 0.55,  # 55% - Depresión (ligeramente más peso)
    "gad7": 0.45   # 45% - Ansiedad
}


# ============================================================
# FUNCIONES DE ANÁLISIS ESTADÍSTICO
# ============================================================

def calculate_trend(scores: List[int]) -> Tuple[str, float, float]:
    """
    Calcula tendencia usando regresión lineal con R² para confiabilidad.
    
    Returns:
        (trend_label, slope, r_squared)
    """
    if len(scores) < 2:
        return "insufficient_data", 0.0, 0.0
    
    # Si todos los scores son iguales, es estable perfecto
    if len(set(scores)) == 1:
        return "stable", 0.0, 1.0
    
    x = np.arange(len(scores))
    y = np.array(scores)
    
    # Regresión lineal: y = mx + b
    coeffs = np.polyfit(x, y, 1)
    slope = coeffs[0]
    intercept = coeffs[1]
    
    # Calcular R² (coeficiente de determinación)
    y_pred = slope * x + intercept
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    
    # Clasificar tendencia con umbrales más granulares
    if slope < TREND_THRESHOLDS["improving_strong"]:
        trend = "improving_strong"
    elif slope < TREND_THRESHOLDS["improving"]:
        trend = "improving"
    elif slope < TREND_THRESHOLDS["stable_upper"]:
        trend = "stable"
    elif slope < TREND_THRESHOLDS["worsening"]:
        trend = "worsening"
    else:
        trend = "worsening_strong"
    
    return trend, float(slope), float(r_squared)


def calculate_volatility(scores: List[int]) -> float:
    """
    Calcula la volatilidad (desviación estándar) de los scores.
    Alta volatilidad indica inestabilidad emocional.
    """
    if len(scores) < 2:
        return 0.0
    
    return float(np.std(scores))


def detect_rapid_changes(scores: List[int], threshold: int = 5) -> Dict:
    """
    Detecta cambios abruptos entre evaluaciones consecutivas.
    Un cambio >= threshold puntos es considerado rápido.
    """
    if len(scores) < 2:
        return {"has_rapid_changes": False, "max_change": 0, "changes": []}
    
    changes = []
    for i in range(1, len(scores)):
        change = scores[i] - scores[i-1]
        if abs(change) >= threshold:
            changes.append({
                "from_index": i-1,
                "to_index": i,
                "change": int(change),
                "direction": "increase" if change > 0 else "decrease"
            })
    
    max_change = max([abs(c["change"]) for c in changes], default=0)
    
    return {
        "has_rapid_changes": len(changes) > 0,
        "max_change": int(max_change),
        "count": len(changes),
        "changes": changes
    }


def calculate_severity_distribution(scores: List[int], test_type: str) -> Dict:
    """
    Calcula el porcentaje de evaluaciones en cada nivel de severidad.
    """
    if not scores:
        return {}
    
    # Umbrales según tipo de test
    if test_type == "phq9":
        thresholds = {"minimal": 5, "mild": 10, "moderate": 15, "severe": 27}
    else:  # gad7
        thresholds = {"minimal": 5, "mild": 10, "moderate": 15, "severe": 21}
    
    distribution = {
        "minimal": 0,
        "mild": 0,
        "moderate": 0,
        "severe": 0
    }
    
    for score in scores:
        if score < thresholds["minimal"]:
            distribution["minimal"] += 1
        elif score < thresholds["mild"]:
            distribution["mild"] += 1
        elif score < thresholds["moderate"]:
            distribution["moderate"] += 1
        else:
            distribution["severe"] += 1
    
    total = len(scores)
    return {k: round((v / total) * 100, 1) for k, v in distribution.items()}


def calculate_consistency(scores: List[int]) -> str:
    """
    Evalúa la consistencia de las evaluaciones.
    Baja varianza = Alta consistencia = Estado emocional estable
    """
    if len(scores) < 3:
        return "insufficient_data"
    
    cv = (np.std(scores) / np.mean(scores) * 100) if np.mean(scores) > 0 else 0
    
    if cv < 15:
        return "high"  # Muy consistente
    elif cv < 30:
        return "medium"  # Moderadamente consistente
    else:
        return "low"  # Inconsistente (alta variabilidad)


# ============================================================
# FUNCIÓN PRINCIPAL DE ANÁLISIS
# ============================================================

def analyze_trends(db: Session, user_id: int, days: int = 30) -> Dict:
    """
    Análisis avanzado de tendencias de PHQ-9 y GAD-7 con múltiples métricas.
    
    Mejoras implementadas:
    - R² para confiabilidad de la tendencia
    - Volatilidad para detectar inestabilidad
    - Detección de cambios rápidos
    - Distribución de severidad
    - Consistencia de evaluaciones
    - Scores ponderados según importancia clínica
    """
    
    # Obtener evaluaciones recientes
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    phq9_assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.type == "phq9",
        models.Assessment.created_at >= cutoff
    ).order_by(models.Assessment.created_at).all()
    
    gad7_assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.type == "gad7",
        models.Assessment.created_at >= cutoff
    ).order_by(models.Assessment.created_at).all()
    
    # Extraer scores
    phq9_scores = [a.score for a in phq9_assessments]
    gad7_scores = [a.score for a in gad7_assessments]
    
    # ========== ANÁLISIS PHQ-9 ==========
    phq9_trend, phq9_slope, phq9_r2 = calculate_trend(phq9_scores)
    phq9_volatility = calculate_volatility(phq9_scores)
    phq9_rapid = detect_rapid_changes(phq9_scores)
    phq9_distribution = calculate_severity_distribution(phq9_scores, "phq9")
    phq9_consistency = calculate_consistency(phq9_scores)
    
    avg_phq9 = float(np.mean(phq9_scores)) if phq9_scores else 0.0
    latest_phq9 = phq9_scores[-1] if phq9_scores else None
    
    # ========== ANÁLISIS GAD-7 ==========
    gad7_trend, gad7_slope, gad7_r2 = calculate_trend(gad7_scores)
    gad7_volatility = calculate_volatility(gad7_scores)
    gad7_rapid = detect_rapid_changes(gad7_scores)
    gad7_distribution = calculate_severity_distribution(gad7_scores, "gad7")
    gad7_consistency = calculate_consistency(gad7_scores)
    
    avg_gad7 = float(np.mean(gad7_scores)) if gad7_scores else 0.0
    latest_gad7 = gad7_scores[-1] if gad7_scores else None
    
    # ========== SCORE MULTIMODAL PONDERADO ==========
    # Normalizar scores (0-100, invertido porque menor es mejor)
    norm_phq9 = 100 - (avg_phq9 / 27 * 100) if avg_phq9 > 0 else 100
    norm_gad7 = 100 - (avg_gad7 / 21 * 100) if avg_gad7 > 0 else 100
    
    # Score ponderado
    tests_score = (norm_phq9 * WEIGHTS["phq9"]) + (norm_gad7 * WEIGHTS["gad7"])
    
    # Penalizar alta volatilidad (inestabilidad)
    volatility_penalty = (phq9_volatility + gad7_volatility) / 2
    adjusted_score = max(0, tests_score - (volatility_penalty * 2))
    
    # Determinar status general
    for status_name, threshold in SCORE_THRESHOLDS.items():
        if adjusted_score >= threshold:
            status = status_name
            break
    
    # ========== RECOMENDACIONES AUTOMÁTICAS ==========
    recommendations = []
    alerts = []
    
    # Alertas críticas
    if latest_phq9 and latest_phq9 >= 20:
        alerts.append("PHQ-9 en nivel crítico (≥20). Evaluación profesional urgente recomendada.")
    if latest_gad7 and latest_gad7 >= 15:
        alerts.append("GAD-7 en nivel severo (≥15). Intervención clínica recomendada.")
    
    # Recomendaciones basadas en tendencias
    if phq9_trend == "worsening_strong" or gad7_trend == "worsening_strong":
        recommendations.append("Tendencia de empeoramiento rápido detectada. Considerar ajuste de tratamiento.")
    
    if phq9_volatility > 5 or gad7_volatility > 5:
        recommendations.append("Alta variabilidad en síntomas. Monitoreo más frecuente recomendado.")
    
    if phq9_rapid["has_rapid_changes"] or gad7_rapid["has_rapid_changes"]:
        recommendations.append("Cambios abruptos detectados. Investigar factores desencadenantes.")
    
    if phq9_trend == "improving_strong" and gad7_trend == "improving_strong":
        recommendations.append("Excelente progreso. Continuar con plan actual.")
    
    # ========== GUARDAR EN BASE DE DATOS ==========
    trend_analysis = models.TrendAnalysis(
        user_id=user_id,
        phq9_trend=phq9_trend,
        phq9_slope=phq9_slope,
        gad7_trend=gad7_trend,
        gad7_slope=gad7_slope,
        tests_score=float(tests_score),
        status=status,
        multimodal_score=float(adjusted_score)
    )
    
    db.add(trend_analysis)
    db.commit()
    db.refresh(trend_analysis)
    
    # ========== RESPUESTA COMPLETA ==========
    return {
        "phq9": {
            "trend": phq9_trend,
            "slope": phq9_slope,
            "r_squared": phq9_r2,
            "confidence": "high" if phq9_r2 > 0.7 else "medium" if phq9_r2 > 0.4 else "low",
            "volatility": phq9_volatility,
            "consistency": phq9_consistency,
            "rapid_changes": phq9_rapid,
            "distribution": phq9_distribution,
            "average": avg_phq9,
            "latest": latest_phq9,
            "count": len(phq9_scores),
            "scores": phq9_scores,
            "dates": [a.created_at.isoformat() for a in phq9_assessments]
        },
        "gad7": {
            "trend": gad7_trend,
            "slope": gad7_slope,
            "r_squared": gad7_r2,
            "confidence": "high" if gad7_r2 > 0.7 else "medium" if gad7_r2 > 0.4 else "low",
            "volatility": gad7_volatility,
            "consistency": gad7_consistency,
            "rapid_changes": gad7_rapid,
            "distribution": gad7_distribution,
            "average": avg_gad7,
            "latest": latest_gad7,
            "count": len(gad7_scores),
            "scores": gad7_scores,
            "dates": [a.created_at.isoformat() for a in gad7_assessments]
        },
        "overall": {
            "tests_score": float(tests_score),
            "adjusted_score": float(adjusted_score),
            "status": status,
            "multimodal_score": float(adjusted_score),
            "volatility_penalty": float(volatility_penalty),
            "days_analyzed": days,
            "total_assessments": len(phq9_scores) + len(gad7_scores)
        },
        "insights": {
            "recommendations": recommendations,
            "alerts": alerts,
            "requires_attention": len(alerts) > 0,
            "overall_trend": "improving" if phq9_trend.startswith("improving") and gad7_trend.startswith("improving") 
                           else "worsening" if phq9_trend.startswith("worsening") or gad7_trend.startswith("worsening")
                           else "stable"
        }
    }