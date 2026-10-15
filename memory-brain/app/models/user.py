"""
User Pydantic Models
====================
Request/Response models ke liye Pydantic V2
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid
from bson import ObjectId


# 🟢 Skill Level Enum
class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"

# 🟢 Project Type Enum
class ProjectType(str, Enum):
    SOLO = "solo"
    TEAM = "team"

# 🟢 User Goal Enum
class GoalType(str, Enum):
    JOB = "job"
    FREELANCE = "freelance"
    STARTUP = "startup"
    LEARNING = "learning"


# 🟢 Tech Stack Item
class TechStackItem(BaseModel):
    language: str = Field(..., description="Like Python, JavaScript")
    framework: str = Field(..., description="Like FastAPI, React")
    proficiency: int = Field(
        ..., ge=1, le=10,  # 1-10 scale
        description="1=Beginner, 10=Expert"
    )


# 🟢 Hardware Specs
class HardwareSpecs(BaseModel):
    ram: str = Field("8GB", description="RAM size")
    os: str = Field("Windows", description="Operating System")
    cpu: Optional[str] = None


# 🟢 User Preferences
class UserPreferences(BaseModel):
    favorite_colors: List[str] = Field(
        default_factory=lambda: ["blue"],
        description="Favorite colors for UI"
    )
    coding_style: str = Field("clean_code", description="clean_code, hacky, robust")
    naming_convention: str = Field("PascalCase", description="For files and variables")
    editor: str = Field("VS Code", description="Preferred code editor")
    theme: str = Field("dark", description="dark or light")


# 🟢 Create User Request
class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6, description="User password")
    skill_level: SkillLevel  # Enum validation
    current_stack: List[TechStackItem] = []
    learning_goals: List[str] = []
    preferences: Optional[UserPreferences] = None
    hardware_specs: Optional[HardwareSpecs] = None
    daily_coding_hours: float = Field(2.0, ge=0.5, le=24.0)
    project_type: ProjectType = ProjectType.SOLO
    goal: GoalType = GoalType.LEARNING
    github_username: Optional[str] = None


# 🟢 User Response (full profile)
class UserResponse(BaseModel):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    skill_level: SkillLevel
    current_stack: List[TechStackItem] = []
    learning_goals: List[str] = []
    preferences: Optional[UserPreferences] = None
    hardware_specs: Optional[HardwareSpecs] = None
    daily_coding_hours: float = 2.0
    project_type: ProjectType = ProjectType.SOLO
    goal: GoalType = GoalType.LEARNING
    github_username: Optional[str] = None
    total_projects: int = 0
    total_learning_days: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # MongoDB ObjectId to string conversion
    model_config = {
        "json_encoders": {ObjectId: str, datetime: lambda v: v.isoformat()}
    }
