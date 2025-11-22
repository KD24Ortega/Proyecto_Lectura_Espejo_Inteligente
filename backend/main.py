from fastapi import FastAPI, Depends
from pydantic import BaseModel
from typing import List
from .db.database import Base, engine, get_db
from .db import models
from sqlalchemy.orm import Session
from .assessments.phq_gad_service import (
    PHQ9_QUESTIONS, GAD7_QUESTIONS,
    phq9_score, gad7_score
)

app = FastAPI(title="Smart Mirror Backend")

Base.metadata.create_all(bind=engine)


class AssessmentRequest(BaseModel):
    user_id: int
    responses: List[int]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/phq9/questions")
def phq9_questions():
    return {"questions": PHQ9_QUESTIONS}


@app.post("/phq9/submit")
def phq9_submit(
    payload: AssessmentRequest,
    db: Session = Depends(get_db)
):
    result = phq9_score(payload.responses)

    assessment = models.Assessment(
        user_id=payload.user_id,
        type="phq9",
        score=result["score"],
        severity=result["severity"]
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return {"id": assessment.id, **result}


@app.get("/gad7/questions")
def gad7_questions():
    return {"questions": GAD7_QUESTIONS}


@app.post("/gad7/submit")
def gad7_submit(
    payload: AssessmentRequest,
    db: Session = Depends(get_db)
):
    result = gad7_score(payload.responses)

    assessment = models.Assessment(
        user_id=payload.user_id,
        type="gad7",
        score=result["score"],
        severity=result["severity"]
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return {"id": assessment.id, **result}
