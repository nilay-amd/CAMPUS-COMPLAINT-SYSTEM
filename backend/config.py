"""
Configuration module for CampusCare AI backend.
Supports multi-provider AI keys (Google Gemini, OpenAI, Anthropic, Groq, Ollama),
NLP thresholds, and deterministic safety rules.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# =========================================================
# MULTI-PROVIDER AGENTIC AI KEYS
# =========================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").strip()

AI_PROVIDER_SETTING = os.getenv("AI_PROVIDER", "auto").strip().lower()

# Default models per provider (can be overridden via .env)
MODELS = {
    "gemini": os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip(),
    "openai": os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip(),
    "anthropic": os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022").strip(),
    "groq": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip(),
    "ollama": os.getenv("OLLAMA_MODEL", "llama3:latest").strip()
}

# =========================================================
# SERVER SETTINGS
# =========================================================
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
SLA_SCALE = float(os.getenv("SLA_SCALE", "1.0"))

# Database Configuration (MongoDB with SQLite fallback)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "campuscare_db")
DB_PATH = BASE_DIR / "campuscare.db"

# =========================================================
# COLOR-CODED PRIORITY TIERS & RESPONSE SLAS (NO POINTS)
# =========================================================
PRIORITY_TIERS = {
    "Critical": {
        "label": "🔴 Critical Hazard",
        "class": "tier-critical",
        "sla_hours": 4 * SLA_SCALE,
        "sla_window": "< 4 Hours",
        "weight": 4
    },
    "High": {
        "label": "🟠 High Urgency",
        "class": "tier-high",
        "sla_hours": 24 * SLA_SCALE,
        "sla_window": "< 24 Hours",
        "weight": 3
    },
    "Medium": {
        "label": "🔵 Medium Priority",
        "class": "tier-medium",
        "sla_hours": 48 * SLA_SCALE,
        "sla_window": "< 48 Hours",
        "weight": 2
    },
    "Low": {
        "label": "🟢 Low / Routine",
        "class": "tier-low",
        "sla_hours": 72 * SLA_SCALE,
        "sla_window": "< 72 Hours",
        "weight": 1
    }
}

DEPARTMENTS = [
    "Electrical",
    "Plumbing",
    "Civil & Academic",
    "IT & Network",
    "Safety & Security"
]

# =========================================================
# NLP & DETERMINISTIC SAFETY LEXICON
# =========================================================
EMERGENCY_KEYWORDS = [
    "fire", "spark", "shock", "electrocution", "smoke", "short circuit",
    "flooding", "burst", "gas leak", "blood", "bleeding", "collapse",
    "injured", "injury", "ragging", "harassment", "physical threat", "weapon",
    "aag", "khoon", "dhuan", "current lag gaya", "bachao", "pani bhar gaya"
]

# Threshold for semantic deduplication / cluster matching
DUPLICATE_SIMILARITY_THRESHOLD = 0.65
