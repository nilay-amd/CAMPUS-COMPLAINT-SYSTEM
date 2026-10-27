"""
CampusCare AI - Dedicated NLP (Natural Language Processing) Engine
Executes:
1. Autonomous Location & Entity Extraction (Hostels, Rooms, Labs, Floors).
2. Autonomous Category & Department Inference (from appliance/problem keywords).
3. Sentiment & Frustration Analysis (Urgency & Emotional Distress detection).
4. Semantic Vector Similarity & Deduplication (TF-IDF + Cosine Distance).
5. Deterministic Multilingual Hazard Lexicon Matching.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
try:
    from . import config
except ImportError:
    import config

# =========================================================
# 1. AUTONOMOUS LOCATION & ENTITY EXTRACTION (NER)
# =========================================================

LOCATION_REGEXES = [
    re.compile(r"\b(hostel\s+[a-z\d]+|block\s+[a-z\d]+)\b", re.IGNORECASE),
    re.compile(r"\b(room\s*(?:no\.?|number)?\s*\d+[a-z]?)\b", re.IGNORECASE),
    re.compile(r"\b(\d+(?:st|nd|rd|th)?\s+floor)\b", re.IGNORECASE),
    re.compile(r"\b(cs\s+lab\s*\d*|ec\s+lab\s*\d*|mechanical\s+workshop|lab\s*\d+)\b", re.IGNORECASE),
    re.compile(r"\b(central\s+library|library|canteen|cafeteria|mess|seminar\s+hall\s*\d*|auditorium|corridor|washroom|restroom|basement|ground)\b", re.IGNORECASE)
]

# Appliance & problem keywords mapping to campus departments
DEPARTMENT_KEYWORD_MAP = {
    "Electrical": [
        "wire", "spark", "shock", "electrocution", "switch", "socket", "fan", "regulator",
        "light", "bulb", "tube", "geyser", "heater", "power", "blackout", "fuse", "voltage"
    ],
    "Plumbing": [
        "water", "tap", "pipe", "pipeline", "leak", "flush", "drain", "drainage",
        "cooler", "purifier", "tank", "basin", "sink", "shower", "flooding", "sewage"
    ],
    "IT & Network": [
        "wifi", "wi-fi", "internet", "router", "network", "lan", "portal", "lms",
        "erp", "server", "gateway", "cable", "dns", "firewall", "bandwidth", "ip"
    ],
    "Civil & Academic": [
        "projector", "chair", "desk", "bench", "door", "window", "lock", "handle",
        "board", "ac", "air conditioner", "blackboard", "glass", "ceiling", "wall", "plaster"
    ],
    "Safety & Security": [
        "theft", "stolen", "harassment", "ragging", "fight", "assault", "threat",
        "guard", "security", "trespassing", "weapon", "drugs", "cctv"
    ]
}

# Emotion & urgency sentiment lexicon
DISTRESS_WORDS = [
    "unbearable", "suffering", "dangerous", "emergency", "immediately",
    "exam tomorrow", "third time", "repeated", "no one cares", "terrible",
    "urgent", "asap", "disaster", "freezing", "burning", "pathetic", "help"
]

def extract_entities_and_location(text: str) -> Dict[str, Any]:
    """
    NLP Extraction: Autonomously extracts physical location and room tokens,
    and infers the responsible campus department without manual user input.
    """
    found_locations = []
    for pat in LOCATION_REGEXES:
        matches = pat.findall(text)
        for m in matches:
            clean = m.strip().title()
            if clean not in found_locations:
                found_locations.append(clean)

    # Detect Department from keywords
    text_lower = text.lower()
    department_scores = {}
    detected_appliances = []

    for dept, keywords in DEPARTMENT_KEYWORD_MAP.items():
        score = 0
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
                score += 1
                detected_appliances.append(kw)
        if score > 0:
            department_scores[dept] = score

    if department_scores:
        inferred_dept = max(department_scores.items(), key=lambda x: x[1])[0]
    else:
        inferred_dept = "General Maintenance"

    location_str = ", ".join(found_locations) if found_locations else "Campus Premises (Unspecified Location)"

    return {
        "location": location_str,
        "locations": found_locations,
        "has_explicit_location": len(found_locations) > 0,
        "inferred_department": inferred_dept,
        "suggested_departments": [inferred_dept] if inferred_dept != "General Maintenance" else [],
        "detected_appliances": detected_appliances
    }

def extract_entities(text: str) -> Dict[str, Any]:
    """Alias for extract_entities_and_location to support all agent callers."""
    return extract_entities_and_location(text)


# =========================================================
# 2. SENTIMENT & FRUSTRATION ANALYZER
# =========================================================

def analyze_sentiment_and_urgency(text: str) -> Dict[str, Any]:
    """
    NLP Sentiment Analysis: Evaluates student emotional frustration and panic levels.
    Detects whether an issue is phrased calmly or with critical distress.
    """
    text_lower = text.lower()
    distress_hits = [w for w in DISTRESS_WORDS if re.search(r"\b" + re.escape(w) + r"\b", text_lower)]

    words = text.split()
    caps_count = sum(1 for w in words if w.isupper() and len(w) > 2)
    is_caps_urgent = caps_count >= 2

    distress_score = len(distress_hits) + (2 if is_caps_urgent else 0)

    if distress_score >= 3:
        frustration_level = "Distressed / High Urgency"
        priority_boost = True
    elif distress_score >= 1:
        frustration_level = "Annoyed / Inconvenienced"
        priority_boost = False
    else:
        frustration_level = "Neutral / Routine"
        priority_boost = False

    return {
        "frustration_level": frustration_level,
        "distress_score": distress_score,
        "priority_boost": priority_boost,
        "detected_distress_cues": distress_hits
    }

# =========================================================
# 3. SEMANTIC VECTOR DEDUPLICATION & SIMILARITY
# =========================================================

def find_semantic_duplicate(
    query_text: str, 
    existing_tickets: List[Dict[str, Any]], 
    threshold: float = config.DUPLICATE_SIMILARITY_THRESHOLD
) -> Optional[Tuple[Dict[str, Any], float]]:
    """
    NLP Vectorizer: Compares TF-IDF semantic embeddings between a new complaint
    and all active open tickets. Returns the matching ticket and similarity score.
    """
    if not existing_tickets or not query_text.strip():
        return None

    corpus = [f"{t['title']} {t['location']} {t['desc']}" for t in existing_tickets]

    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform(corpus + [query_text])
        sims = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1])[0]

        best_idx = int(sims.argmax())
        best_score = float(sims[best_idx])

        if best_score >= threshold:
            return existing_tickets[best_idx], round(best_score, 2)
    except Exception as e:
        print(f"[NLP Vectorizer Warning] Deduplication failed: {e}")

    return None

# =========================================================
# 4. DETERMINISTIC HAZARD LEXICON MATCHER
# =========================================================

def match_emergency_hazards(text: str) -> List[str]:
    """
    Deterministic regex pattern matcher across multilingual safety keywords.
    """
    text_lower = text.lower()
    matches = []
    for kw in config.EMERGENCY_KEYWORDS:
        if re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
            matches.append(kw)
    return matches
