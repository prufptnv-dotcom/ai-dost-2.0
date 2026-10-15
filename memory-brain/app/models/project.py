# backend/app/models/project.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import uuid4

class ProjectStatus(str, Enum):
    MVP = "mvp"
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    ARCHIVED = "archived"

class TechItem(BaseModel):
    name: str = Field(..., description="Technology name (e.g., React, Docker)")
    version: Optional[str] = None
    purpose: str = Field(..., description="Role in project (e.g., frontend, database)")

class ErrorEntry(BaseModel):
    error_message: str
    solution: Optional[str] = None
    recurrence_count: int = Field(1, ge=1)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ProjectRequest(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field("", description="Project description")
    tech_stack: List[TechItem] = []
    architecture: Optional[str] = Field(default_factory=lambda: "# Architecture")
    folder_structure: Optional[str] = Field(default_factory=lambda: "# Folder Structure")
    features: List[str] = []
    errors_faced: List[ErrorEntry] = []
    deployment: Optional[Dict[str, Any]] = Field(default_factory=dict)
    github_repo: Optional[str] = None
    project_type: ProjectStatus = ProjectStatus.MVP
    collaborators: List[Dict[str, Any]] = []

class ProjectResponse(ProjectRequest):
    project_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str = Field(..., description="Reference to user")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: ProjectStatus = ProjectStatus.MVP
    total_commits: int = 0
    last_deployment: Optional[datetime] = None
    collaborators: List[Dict[str, Any]] = []
