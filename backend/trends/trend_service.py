from sqlalchemy.orm import Session
from backend.db import models
from datetime import datetime, timedelta
import numpy as np

def calculate_trend(scores):
    """Calcula tendencia usando regresión lineal simple"""
    if len(scores) < 2:
        return "stable", 0.0
    
    x = np.arange(len(scores))
    y = np.array(scores)
    
    # Regresión lineal: y = mx + b
    slope = np.polyfit(x, y, 1)[0]
    
    # Clasificar tendencia
    if slope < -1:
        return "improving", slope
    elif slope > 1:
        return "worsening", slope
    else:
        return "stable", slope


def analyze_trends(db: Session, user_id: int, days: int = 30):
    """Analiza tendencias de PHQ-9 y GAD-7"""
    
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
    
    # Calcular tendencias
    phq9_scores = [a.score for a in phq9_assessments]
    gad7_scores = [a.score for a in gad7_assessments]
    
    phq9_trend, phq9_slope = calculate_trend(phq9_scores)
    gad7_trend, gad7_slope = calculate_trend(gad7_scores)
    
    # Calcular score de tests (0-100, invertido porque menor es mejor)
    avg_phq9 = float(np.mean(phq9_scores)) if phq9_scores else 0.0
    avg_gad7 = float(np.mean(gad7_scores)) if gad7_scores else 0.0
    
    # Normalizar: PHQ-9 max=27, GAD-7 max=21
    tests_score = 100 - ((avg_phq9/27 + avg_gad7/21) / 2 * 100)
    
    # Determinar status general
    if tests_score >= 80:
        status = "excellent"
    elif tests_score >= 60:
        status = "good"
    elif tests_score >= 40:
        status = "moderate"
    elif tests_score >= 20:
        status = "concerning"
    else:
        status = "critical"
    
    # Guardar análisis
    trend_analysis = models.TrendAnalysis(
        user_id=user_id,
        phq9_trend=phq9_trend,
        phq9_slope=float(phq9_slope),
        gad7_trend=gad7_trend,
        gad7_slope=float(gad7_slope),
        tests_score=float(tests_score),
        status=status,
        multimodal_score=float(tests_score)  # Por ahora solo tests
    )
    
    db.add(trend_analysis)
    db.commit()
    db.refresh(trend_analysis)
    
    return {
        "phq9": {
            "trend": phq9_trend,
            "slope": float(phq9_slope),
            "scores": phq9_scores,
            "dates": [a.created_at.isoformat() for a in phq9_assessments]
        },
        "gad7": {
            "trend": gad7_trend,
            "slope": float(gad7_slope),
            "scores": gad7_scores,
            "dates": [a.created_at.isoformat() for a in gad7_assessments]
        },
        "overall": {
            "tests_score": float(tests_score),
            "status": status,
            "multimodal_score": float(tests_score)
        }
    }