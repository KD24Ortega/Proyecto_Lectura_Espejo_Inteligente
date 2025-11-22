from typing import List, Dict


PHQ9_QUESTIONS = [
    "Poco interés o placer en hacer cosas",
    "Se ha sentido decaído(a), deprimido(a) o sin esperanzas",
    "Dificultad para quedarse dormido(a) o dormir demasiado",
    "Se ha sentido cansado(a) o con poca energía",
    "Sin apetito o ha comido en exceso",
    "Se ha sentido mal consigo mismo(a)",
    "Dificultad para concentrarse",
    "Se ha movido o hablado muy lento o muy inquieto(a)",
    "Pensamientos de hacerse daño o que estaría mejor muerto(a)"
]

GAD7_QUESTIONS = [
    "Sentirse nervioso(a), ansioso(a) o con los nervios de punta",
    "No ser capaz de parar o controlar la preocupación",
    "Preocuparse demasiado por diferentes cosas",
    "Dificultad para relajarse",
    "Estar tan inquieto(a) que es difícil quedarse quieto(a)",
    "Irritarse o enfadarse con facilidad",
    "Tener miedo de que algo terrible pueda pasar"
]


def phq9_score(responses: List[int]) -> Dict:
    if len(responses) != 9:
        raise ValueError("PHQ-9 requiere 9 respuestas")

    score = sum(responses)

    if score <= 4:
        sev = "minima"
    elif score <= 9:
        sev = "leve"
    elif score <= 14:
        sev = "moderada"
    elif score <= 19:
        sev = "moderadamente severa"
    else:
        sev = "severa"

    return {"score": score, "severity": sev}


def gad7_score(responses: List[int]) -> Dict:
    if len(responses) != 7:
        raise ValueError("GAD-7 requiere 7 respuestas")

    score = sum(responses)

    if score <= 4:
        sev = "minima"
    elif score <= 9:
        sev = "leve"
    elif score <= 14:
        sev = "moderada"
    else:
        sev = "severa"

    return {"score": score, "severity": sev}
