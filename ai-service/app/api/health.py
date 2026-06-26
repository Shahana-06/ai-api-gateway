"""
app/api/health.py

GET /health — checked by Node gateway before routing requests here.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}