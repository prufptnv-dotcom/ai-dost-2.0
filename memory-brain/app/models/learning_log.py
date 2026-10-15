# backend/app/models/learning_log.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from uuid import uuid4

class ConfidenceLevel(int, Enum):
    ONE = 1
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10

class ResourceItem(BaseModel):
    type: str = Field(..., description="book/pdf/video/website")
    url: Optional[str] = None
    notes: Optional[str] = None

class MistakeEntry(BaseModel):
    description: str
    solution: Optional[str] = None
    recurrence_count: int = Field(1, ge=1)

class LearningLogRequest(BaseModel):
    date: datetime = Field(default_factory=datetime.today)
    topic: str = Field(..., min_length=3)
    concept: str = Field(..., min_length=10)
    resources: List[ResourceItem] = []
    mistakes: List[MistakeEntry] = []
    confidence_level: ConfidenceLevel = ConfidenceLevel.FIVE
    next_steps: List[str] = []

class LearningLogResponse(LearningLogRequest):
    log_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str = Field(..., description="Reference to user")
    created_at: datetime = Field(default_factory=datetime.utcnow)
