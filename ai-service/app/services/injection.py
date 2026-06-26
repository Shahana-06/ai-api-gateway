"""
app/services/injection.py

Rule-based prompt injection detection.
Runs BEFORE the body reaches the LLM — if it matches, we reject immediately.
Zero cost, zero latency.
"""

BLOCKED_PATTERNS = [
    "ignore previous instructions",
    "ignore all previous",
    "disregard your",
    "disregard the above",
    "you are now",
    "act as if",
    "forget everything",
    "new instructions:",
    "system prompt",
    "system:",
    "<inst>",
    "jailbreak",
    "do anything now",
    "dan mode",
]

def is_injection(text: str) -> bool:
    """Returns True if the text contains a known injection pattern."""
    lowered = text.lower()
    return any(pattern in lowered for pattern in BLOCKED_PATTERNS)