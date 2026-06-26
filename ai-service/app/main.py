"""
app/main.py

FastAPI application entry point.
Registers routers and handles startup/shutdown lifecycle.
"""

from fastapi import FastAPI
from app.api.classify import router as classify_router
from app.api.health import router as health_router

app = FastAPI(
    title="AI Gateway — AI Service",
    version="1.0.0",
    description="Intent classification and injection detection",
)

app.include_router(health_router)
app.include_router(classify_router)