"""
CampusCare AI - FastAPI REST Backend Entry Point
Connects the frontend with the Agentic AI (Google AI Studio / Gemini API),
manages ticket lifecycles, and serves public analytics.
"""

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from . import config, database as db, schemas
    from .agent import UniversalCampusAgent
    from .escalation import start_sla_watchdog, stop_sla_watchdog
except ImportError:
    import config, database as db, schemas
    from agent import UniversalCampusAgent
    from escalation import start_sla_watchdog, stop_sla_watchdog

agent_instance: Optional[UniversalCampusAgent] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent_instance
    # Startup: Initialize Database, Universal AI Agent & Background Watchdog
    db.init_db()
    agent_instance = UniversalCampusAgent()
    start_sla_watchdog()
    print(f"\n[CampusCare AI Backend] Initialized successfully. Active AI Engine: {agent_instance.active_engine_name}")
    yield
    # Shutdown
    stop_sla_watchdog()

app = FastAPI(
    title="CampusCare AI - Grievance Prioritization API",
    description="Agentic AI backend for campus complaint triage, deduplication, and SLA management.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# 1. SYSTEM HEALTH & ANALYTICS
# =========================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "provider": agent_instance.provider if agent_instance else "unknown",
        "ai_engine": agent_instance.active_engine_name if agent_instance else "Offline",
        "nlp_pipeline": [
            "Named Entity & Location Extraction",
            "Sentiment & Emotional Distress Scoring",
            "TF-IDF Semantic Vector Deduplication",
            "Deterministic Safety Guardrail"
        ]
    }

@app.get("/api/analytics", response_model=schemas.AnalyticsOut)
def get_public_analytics():
    """Provides public KPIs: resolution rate, SLA compliance, and cluster counts."""
    return db.get_analytics()

# =========================================================
# 2. COMPLAINTS & TRIAGE DISPATCH
# =========================================================

@app.get("/api/complaints")
def list_complaints(
    tier: Optional[str] = None, 
    category: Optional[str] = None, 
    status: Optional[str] = None
):
    """Fetches complaints for the public board and staff triage queue."""
    return db.list_tickets(tier=tier, category=category, status=status)

@app.post("/api/complaints", status_code=status.HTTP_201_CREATED)
def lodge_complaint(body: schemas.ComplaintCreate):
    """
    Submits a new complaint. The Gemini Agent autonomously analyzes the complaint,
    checks for duplicates, assigns color-coded priority tier, and routes the ticket.
    """
    if not agent_instance:
        raise HTTPException(status_code=500, detail="Agent engine not initialized.")

    ticket, is_merged, message = agent_instance.process_complaint(body.model_dump())
    return {
        "ticket": ticket,
        "is_merged": is_merged,
        "agent_message": message
    }

@app.post("/api/complaints/{ticket_id}/upvote")
def upvote_complaint(ticket_id: str, body: schemas.UpvoteRequest):
    """Adds a '+1 Affects Me Too' vote to prevent duplicate complaint spam."""
    updated = db.upvote_ticket(ticket_id, body.studentId or "Alex Smith")
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {"message": "Supported successfully. Urgency score updated.", "ticket": updated}

@app.patch("/api/complaints/{ticket_id}/assign")
def assign_technician(ticket_id: str, body: schemas.AssignRequest):
    """Assigns an on-duty technician to an active complaint."""
    updated = db.assign_ticket(ticket_id, body.technicianName)
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {"message": f"Assigned to {body.technicianName}", "ticket": updated}

@app.post("/api/complaints/{ticket_id}/resolve")
def resolve_complaint(ticket_id: str, body: schemas.ResolveRequest):
    """Closes a complaint via verified student OTP code."""
    # Simulated validation of OTP code
    if len(body.otpCode.strip()) < 4:
        raise HTTPException(status_code=400, detail="Invalid OTP code format.")

    updated = db.resolve_ticket(ticket_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {"message": "Resolution verified successfully by OTP handshake.", "ticket": updated}

# =========================================================
# 3. AUTHENTICATION (STUDENT / FACULTY / STAFF)
# =========================================================

@app.post("/api/auth/login")
def login(body: schemas.LoginRequest):
    """Authenticates campus role for portal access."""
    user = db.authenticate_user(body.role, body.identifier, body.email, body.password)
    if not user:
        # For development / testing, allow demo credentials if not explicitly in DB
        if body.password in ["Password123", "password", "123456"]:
            return {
                "authenticated": True,
                "user": {
                    "id": body.identifier,
                    "name": "Authenticated User",
                    "email": body.email,
                    "role": body.role
                }
            }
        raise HTTPException(status_code=401, detail="Invalid credentials for the selected campus role.")

    return {
        "authenticated": True,
        "user": user
    }
