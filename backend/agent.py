"""
Universal Multi-Provider Agentic AI Engine for CampusCare.
Integrates:
- Any AI Provider: Google AI Studio (Gemini), OpenAI (GPT-4o), Anthropic (Claude), Groq (Llama-3), or Local Ollama.
- First-Class NLP Engine: Entity extraction, sentiment/distress scoring, and semantic deduplication.
- Deterministic Emergency Safety Rules.
"""

import json
import re
from typing import Dict, Any, Tuple, Optional
try:
    from . import config, database as db, nlp_engine
except ImportError:
    import config, database as db, nlp_engine

# ---------------------------------------------------------
# Dynamic SDK Imports (Graceful failover if SDK is not installed)
# ---------------------------------------------------------
try:
    from google import genai
    from google.genai import types as genai_types
    GOOGLE_GENAI_READY = True
except ImportError:
    try:
        import google.generativeai as genai_legacy
        GOOGLE_GENAI_READY = "legacy"
    except ImportError:
        GOOGLE_GENAI_READY = False

try:
    import openai
    OPENAI_READY = True
except ImportError:
    OPENAI_READY = False

try:
    import anthropic
    ANTHROPIC_READY = True
except ImportError:
    ANTHROPIC_READY = False

try:
    from groq import Groq
    GROQ_READY = True
except ImportError:
    GROQ_READY = False

import httpx


class UniversalCampusAgent:
    """
    Universal Agentic AI Gateway. Auto-detects available provider API keys,
    fuses deep NLP extraction, and performs autonomous triage.
    """
    def __init__(self):
        self.provider = "fallback"
        self.client = None
        self.detect_and_init_provider()

    def detect_and_init_provider(self):
        """Auto-detects active API key and initializes client."""
        override = config.AI_PROVIDER_SETTING

        # 1. Google AI Studio (Gemini)
        if (override in ["gemini", "auto"]) and config.GEMINI_API_KEY:
            if GOOGLE_GENAI_READY is True:
                try:
                    self.client = genai.Client(api_key=config.GEMINI_API_KEY)
                    self.provider = "gemini"
                    print("[CampusCare AI] Activated: Google AI Studio (Gemini 2.0 Flash)")
                    return
                except Exception as e:
                    print(f"[Warning] Gemini client init failed: {e}")
            elif GOOGLE_GENAI_READY == "legacy":
                try:
                    genai_legacy.configure(api_key=config.GEMINI_API_KEY)
                    self.client = genai_legacy.GenerativeModel(config.MODELS["gemini"])
                    self.provider = "gemini-legacy"
                    print("[CampusCare AI] Activated: Google AI Studio (Gemini Legacy SDK)")
                    return
                except Exception as e:
                    print(f"[Warning] Gemini legacy init failed: {e}")

        # 2. OpenAI (GPT-4o)
        if (override in ["openai", "auto"]) and config.OPENAI_API_KEY and OPENAI_READY:
            try:
                self.client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
                self.provider = "openai"
                print(f"[CampusCare AI] Activated: OpenAI ({config.MODELS['openai']})")
                return
            except Exception as e:
                print(f"[Warning] OpenAI init failed: {e}")

        # 3. Anthropic (Claude 3.5)
        if (override in ["anthropic", "auto"]) and config.ANTHROPIC_API_KEY and ANTHROPIC_READY:
            try:
                self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
                self.provider = "anthropic"
                print(f"[CampusCare AI] Activated: Anthropic ({config.MODELS['anthropic']})")
                return
            except Exception as e:
                print(f"[Warning] Anthropic init failed: {e}")

        # 4. Groq (Fast Llama-3)
        if (override in ["groq", "auto"]) and config.GROQ_API_KEY and GROQ_READY:
            try:
                self.client = Groq(api_key=config.GROQ_API_KEY)
                self.provider = "groq"
                print(f"[CampusCare AI] Activated: Groq ({config.MODELS['groq']})")
                return
            except Exception as e:
                print(f"[Warning] Groq init failed: {e}")

        # 5. Local Ollama
        if (override in ["ollama", "auto"]) and config.OLLAMA_BASE_URL:
            self.provider = "ollama"
            self.client = config.OLLAMA_BASE_URL
            print(f"[CampusCare AI] Activated: Local Ollama at {config.OLLAMA_BASE_URL}")
            return

        # 6. Built-in Local NLP Heuristic Engine
        self.provider = "local_nlp"
        self.client = None
        print("[CampusCare AI] No external API key detected. Running on Native NLP Engine (Zero-Key Mode).")

    @property
    def active_engine_name(self) -> str:
        names = {
            "gemini": f"Google AI Studio ({config.MODELS['gemini']})",
            "gemini-legacy": f"Google AI Studio ({config.MODELS['gemini']})",
            "openai": f"OpenAI ({config.MODELS['openai']})",
            "anthropic": f"Anthropic ({config.MODELS['anthropic']})",
            "groq": f"Groq ({config.MODELS['groq']})",
            "ollama": f"Local Ollama ({config.MODELS['ollama']})",
            "local_nlp": "Native NLP & Heuristic Engine"
        }
        return names.get(self.provider, "Native NLP Engine")

    # =========================================================
    # UNIVERSAL LLM DISPATCHER
    # =========================================================
    def call_active_llm(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Invokes whichever AI provider client is active with structured JSON."""
        try:
            # 1. Google Gemini
            if self.provider == "gemini":
                response = self.client.models.generate_content(
                    model=config.MODELS["gemini"],
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(response_mime_type="application/json")
                )
                return json.loads(response.text)

            elif self.provider == "gemini-legacy":
                response = self.client.generate_content(prompt)
                clean_json = re.sub(r"```json|```", "", response.text).strip()
                return json.loads(clean_json)

            # 2. OpenAI
            elif self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=config.MODELS["openai"],
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                return json.loads(response.choices[0].message.content)

            # 3. Anthropic Claude
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model=config.MODELS["anthropic"],
                    max_tokens=600,
                    messages=[{"role": "user", "content": prompt + "\nOutput strictly valid JSON only."}]
                )
                text = response.content[0].text
                clean_json = re.sub(r"```json|```", "", text).strip()
                return json.loads(clean_json)

            # 4. Groq
            elif self.provider == "groq":
                response = self.client.chat.completions.create(
                    model=config.MODELS["groq"],
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                return json.loads(response.choices[0].message.content)

            # 5. Local Ollama
            elif self.provider == "ollama":
                res = httpx.post(
                    f"{self.client}/api/generate",
                    json={"model": config.MODELS["ollama"], "prompt": prompt, "format": "json", "stream": False},
                    timeout=15.0
                )
                if res.status_code == 200:
                    return json.loads(res.json()["response"])

        except Exception as e:
            print(f"[Agent Call Error on {self.provider}]: {e}")

        return None

    # =========================================================
    # MASTER AGENT EXECUTION (FUSING NLP + LLM REASONING)
    # =========================================================
    def process_complaint(self, data: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, str]:
        """
        Full Agentic Pipeline:
        1. NLP Entity Extraction (Finds room, block, appliances).
        2. NLP Sentiment Analysis (Measures emotional distress/urgency).
        3. NLP Semantic Deduplication (Checks for active duplicates in that location).
        4. Deterministic Hazard Safety Check.
        5. AI Reasoning (via Google AI Studio, OpenAI, Claude, Groq, or Local NLP).
        6. Dynamic Ticket Enqueue or Cluster Merge.
        """
        title = data["title"]
        desc = data["desc"]
        student_id = data.get("reportedBy", "Student")

        # --- STEP 1: NLP Entity Extraction (Autonomous — no user-provided category/location) ---
        combined_text = f"{title} {desc}"
        nlp_entities = nlp_engine.extract_entities(combined_text)

        # Derive location and category from NLP extraction
        detected_locations = nlp_entities.get("locations", [])
        detected_departments = nlp_entities.get("suggested_departments", [])
        ai_category = detected_departments[0] if detected_departments else "Civil & Academic"
        ai_location = ", ".join(detected_locations) if detected_locations else "Campus (Location not specified)"

        # --- STEP 2: NLP Sentiment & Frustration Analysis ---
        nlp_sentiment = nlp_engine.analyze_sentiment_and_urgency(combined_text)

        # --- STEP 3: NLP Semantic Deduplication ---
        active_tickets = db.list_tickets(status="Pending") + db.list_tickets(status="Assigned")
        duplicate_match = nlp_engine.find_semantic_duplicate(
            combined_text,
            active_tickets,
            threshold=config.DUPLICATE_SIMILARITY_THRESHOLD
        )

        if duplicate_match:
            existing_ticket, similarity_score = duplicate_match
            updated = db.upvote_ticket(existing_ticket["id"], student_id)
            return (
                updated,
                True,
                f"[NLP Deduplication] Matched existing cluster {existing_ticket['id']} ({int(similarity_score * 100)}% match). Merged report and boosted priority."
            )

        # --- STEP 4: Deterministic Hazard Safety Check (keyword-based, no user checkbox) ---
        emergency_keywords = nlp_engine.match_emergency_hazards(combined_text)
        is_deterministic_emergency = len(emergency_keywords) > 0

        # --- STEP 5: AI Provider Reasoning & Decision ---
        ai_decision = None
        if self.provider != "local_nlp" and not is_deterministic_emergency:
            prompt = f"""
            You are the Autonomous Campus Grievance Triage Agent.
            Analyze the following complaint. The user only provided a title and free-text description.
            Your job is to EXTRACT category, location, hazard status, and assign priority — all autonomously.

            COMPLAINT:
            - Title: {title}
            - Full Description: {desc}

            NLP PRE-PROCESSING RESULTS:
            - Detected Campus Locations: {detected_locations}
            - Detected Appliances/Equipment: {nlp_entities.get('appliances', [])}
            - Student Frustration Level: {nlp_sentiment['frustration_level']} (Distress score: {nlp_sentiment['distress_score']})
            - Suggested Departments (NLP): {detected_departments}

            OBJECTIVES:
            1. Assign one of 4 strict Priority Tiers (NO numeric points ever):
               - 'Critical': Life/safety risk (fire, electrocution, flooding, gas, physical threat). SLA < 4 Hours.
               - 'High': Major utility breakdown affecting living/working (no power, no water, exam blocker). SLA < 24 Hours.
               - 'Medium': Connectivity, projector, classroom equipment. SLA < 48 Hours.
               - 'Low': Minor cosmetic or routine maintenance. SLA < 72 Hours.
            2. Determine whether a safety hazard exists from the description text alone.
            3. Extract the most precise location mentioned (hostel block, room, lab, floor, building).
            4. Assign the correct department and a dispatch technician unit.

            Return ONLY valid JSON:
            {{
                "tier": "Critical" | "High" | "Medium" | "Low",
                "is_hazard": true | false,
                "category": "Electrical" | "Plumbing" | "Civil & Academic" | "IT & Network" | "Safety & Security",
                "location": "extracted location string",
                "assigned_to": "Technician Unit Name",
                "agent_summary": "1 sentence action plan"
            }}
            """
            ai_decision = self.call_active_llm(prompt)

        # --- Local NLP Fallback (if no LLM or deterministic emergency) ---
        if not ai_decision:
            if is_deterministic_emergency:
                ai_decision = {
                    "tier": "Critical",
                    "is_hazard": True,
                    "category": ai_category if ai_category in config.DEPARTMENTS else "Safety & Security",
                    "location": ai_location,
                    "assigned_to": "Rapid Hazard Response Unit",
                    "agent_summary": f"Emergency safety hazard auto-detected via keywords {emergency_keywords}. Immediate dispatch."
                }
            elif ai_category in ["Electrical", "Plumbing"] or nlp_sentiment.get("priority_boost"):
                ai_decision = {
                    "tier": "High",
                    "is_hazard": False,
                    "category": ai_category,
                    "location": ai_location,
                    "assigned_to": f"{ai_category} Maintenance Crew",
                    "agent_summary": f"High priority utility issue routed via NLP (frustration: {nlp_sentiment['frustration_level']})."
                }
            elif ai_category == "IT & Network":
                ai_decision = {
                    "tier": "Medium",
                    "is_hazard": False,
                    "category": "IT & Network",
                    "location": ai_location,
                    "assigned_to": "IT Campus Network Team",
                    "agent_summary": "Digital infrastructure grievance triaged for inspection."
                }
            else:
                ai_decision = {
                    "tier": "Low",
                    "is_hazard": False,
                    "category": "Civil & Academic",
                    "location": ai_location,
                    "assigned_to": "Routine Facilities Team",
                    "agent_summary": "Routine maintenance complaint enqueued under standard SLA."
                }

        # Use AI-extracted or NLP-extracted values (never user-provided)
        resolved_location = ai_decision.get("location") or ai_location
        resolved_category = ai_decision.get("category") or ai_category

        # --- STEP 6: Persist Ticket ---
        ticket_id = f"CMP-{abs(hash(title + desc)) % 900 + 100}"
        tier = ai_decision.get("tier", "Medium")

        ticket_payload = {
            "id": ticket_id,
            "title": title,
            "category": resolved_category,
            "location": resolved_location,
            "room": "",
            "desc": desc,
            "tier": tier,
            "assigned_to": ai_decision.get("assigned_to", "Triage Queue"),
            "is_hazard": 1 if ai_decision.get("is_hazard") else 0,
            "is_anonymous": 1 if data.get("isAnonymous") else 0,
            "reported_by": "Anonymous Student" if data.get("isAnonymous") else student_id,
            "upvotes": 1,
            "status": "Pending"
        }

        created = db.create_ticket(ticket_payload)
        return created, False, f"Ticket {ticket_id} created under {tier} tier via {self.active_engine_name}."
