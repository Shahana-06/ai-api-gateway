"""
main.py — FastAPI application entry point.
Implemented in Phase 3.
"""
from fastapi import FastAPI

app = FastAPI(title="AI Gateway — AI Service", version="1.0.0")

@app.get("/health")
async def health():
    return {"status": "ok"}
