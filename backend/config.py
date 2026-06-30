"""
config.py
AI Meeting Watchdog — Backend Configuration

Reads environment variables. Copy .env.example → .env and fill in values.
Never commit actual API keys.

Required env vars:
  ANTHROPIC_API_KEY   — Claude API key (claude-sonnet-4-6 model)
  WHISPER_MODEL       — Whisper model size: tiny | base | small | medium | large
                        "base" is the sweet spot for hackathon speed vs accuracy.
  PORT                — Server port (default: 8000)
"""

import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set.")
WHISPER_MODEL: str     = os.environ.get("WHISPER_MODEL", "base")
PORT: int              = int(os.environ.get("PORT", 8000))
CORS_ORIGINS: list     = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

