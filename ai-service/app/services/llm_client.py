"""
app/services/llm_client.py

Using Groq — free tier, fast, generous limits.
Model: llama-3.1-8b-instant — fast and good enough for intent classification.
"""

from groq import Groq
from app.config import settings

_client = Groq(api_key=settings.groq_api_key)

VALID_INTENTS = ["payments", "analytics", "auth", "notifications", "unknown"]

SYSTEM_PROMPT = """You are an intent classifier for an API gateway.
Given a JSON request body, return ONLY valid JSON with no explanation, no markdown, no preamble.

Valid intents and their routes:
- "payments"      → "http://localhost:4001"
- "analytics"     → "http://localhost:4002"
- "auth"          → "http://localhost:4003"
- "notifications" → "http://localhost:4004"

If you cannot classify with confidence >= 0.7, use intent "unknown" and route null.

Response format (return ONLY this, nothing else):
{"intent": "<intent>", "confidence": <float 0.0-1.0>, "route": "<url or null>"}"""


async def classify_intent(body: str) -> dict:
    import json

    response = _client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=100,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"Classify this request body: {body}"}
        ]
    )

    raw = response.choices[0].message.content.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        return {"intent": "unknown", "confidence": 0.0, "route": None, "tokens_used": 0}

    if result.get("intent") not in VALID_INTENTS:
        result["intent"] = "unknown"
        result["route"]  = None

    return {
        "intent":      result.get("intent", "unknown"),
        "confidence":  float(result.get("confidence", 0.0)),
        "route":       result.get("route", None),
        "tokens_used": response.usage.total_tokens,
    }