"""
Pydantic validation schemas for CampusCare AI backend.
Matches the frontend models and API requests.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any

class ComplaintCreate(BaseModel):
    """
    Simplified payload — manual category/location/hazard are optional.
    The Agentic AI + NLP engine extracts all of these autonomously from title + desc.
    """
    title: str = Field(..., min_length=3, max_length=200)
    desc: str = Field(..., min_length=3)
    category: Optional[str] = None
    location: Optional[str] = None
    room: Optional[str] = None
    isHazard: Optional[bool] = False
    isAnonymous: Optional[bool] = False
    reportedBy: Optional[str] = "Student"

class ComplaintOut(BaseModel):
    id: str
    title: str
    category: str
    location: str
    room: Optional[str] = ""
    desc: str
    tier: str
    tier_label: str
    tier_class: str
    sla_window: str
    status: str
    assigned_to: str
    is_hazard: int
    is_anonymous: int
    reported_by: str
    upvotes: int
    created_at: str
    updated_at: str
    due_at: str
    resolved_at: Optional[str] = None

class UpvoteRequest(BaseModel):
    studentId: Optional[str] = "Alex Smith"

class AssignRequest(BaseModel):
    technicianName: str = Field(..., min_length=2)

class ResolveRequest(BaseModel):
    otpCode: str = Field(..., min_length=4)

class LoginRequest(BaseModel):
    role: str
    identifier: str
    email: str
    password: str

class AnalyticsOut(BaseModel):
    total_tickets: int
    active_count: int
    resolved_count: int
    cluster_count: int
    resolution_rate: str
    sla_compliance: str
    avg_resolution_time: str
