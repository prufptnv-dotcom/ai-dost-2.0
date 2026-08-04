# backend/app/services/memory_service.py
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.user import UserResponse
from app.models.project import ProjectRequest, ProjectResponse
from app.models.learning_log import LearningLogRequest
from app.services.vector_service import VectorService

class MemoryService:
    def __init__(self, db: Optional[AsyncIOMotorDatabase]):
        self.db = db
        self.users = db.users if db is not None else None
        self.projects = db.projects if db is not None else None
        self.learning_logs = db.learning_logs if db is not None else None

    async def build_context(self, user: UserResponse, new_project: ProjectRequest) -> dict:
        """Builds execution context for Master Brain"""
        query = f"project: {new_project.project_name}. description: {new_project.description}."
        vector_memories = await VectorService.query_memory(user_id=user.user_id, query=query, limit=3)
        
        context = {
            "user": {
                "skill": user.skill_level.value,
                "stack": [f"{item.language}@{item.proficiency}" 
                          for item in user.current_stack],
                "preferences": user.preferences.model_dump() if user.preferences else {},
                "hardware": user.hardware_specs.model_dump() if user.hardware_specs else {}
            },
            "project": new_project.model_dump(),
            "history": await self.get_relevant_projects(user.user_id),
            "learning": await self.get_learning_trend(user.user_id),
            "semantic_memories": vector_memories
        }
        return context

    async def get_projects(self, user_id: str) -> List[dict]:
        if self.projects is None:
            return []
        cursor = self.projects.find({"user_id": user_id})
        projects = await cursor.to_list(length=100)
        for p in projects:
            p["_id"] = str(p["_id"])
        return projects

    async def get_relevant_projects(self, user_id: str) -> List[dict]:
        if self.projects is None:
            return []
        # Filter by similar tech stack and project type
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$project": {
                "_id": 0,
                "project_name": 1,
                "tech_stack": 1,
                "project_type": 1
            }}
        ]
        cursor = self.projects.aggregate(pipeline)
        return await cursor.to_list(length=100)

    async def get_learning_trend(self, user_id: str) -> List[dict]:
        if self.learning_logs is None:
            return []
        # Analyze learning progression
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$topic",
                "total_sessions": {"$sum": 1},
                "confidence_avg": {"$avg": "$confidence_level"},
                "mistakes_count": {"$sum": {"$size": "$mistakes"}}
            }}
        ]
        cursor = self.learning_logs.aggregate(pipeline)
        return await cursor.to_list(length=100)

    async def semantic_search(self, query: str, user_id: str, limit: int = 5) -> List[dict]:
        # Use sentence-transformers + ChromaDB vector search
        return await VectorService.query_memory(user_id=user_id, query=query, limit=limit)
