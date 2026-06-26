"""
app/api/classify.py

POST /classify — the only endpoint the Node gateway calls.

Request body:
  { "body": "<raw request body as string>", "tenant_id": "optional" }

Response:
  { "intent": "payments", "confidence": 0.91, "route": "http://localhost:4001", "tokens_used": 42 }
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.services.llm_client import classify_intent
from app.services.injection import is_injection

router = APIRouter()


class ClassifyRequest(BaseModel):
    body: str
    tenant_id: Optional[str] = None


class ClassifyResponse(BaseModel):
    intent: str
    confidence: float
    route: Optional[str]
    tokens_used: int = 0
    injection_detected: bool = False


@router.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest):
    # 1. Injection check first — before any LLM call
    if is_injection(req.body):
        return ClassifyResponse(
            intent="blocked",
            confidence=1.0,
            route=None,
            tokens_used=0,
            injection_detected=True,
        )

    # 2. Classify with LLM
    result = await classify_intent(req.body)

    return ClassifyResponse(
        intent=result["intent"],
        confidence=result["confidence"],
        route=result["route"],
        tokens_used=result.get("tokens_used", 0),
        injection_detected=False,
    )