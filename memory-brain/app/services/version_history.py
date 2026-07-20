from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import List, Dict, Any

class VersionHistoryRequest(BaseModel):
    project_id: str
    file_path: str
    content: str
    user_id: str

class VersionHistoryService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def record_version(self, request: VersionHistoryRequest) -> bool:
        try:
            version = {
                "timestamp": datetime.utcnow(),
                "content": request.content,
                "user_id": request.user_id
            }
            project = await self.db.projects.find_one({"project_id": request.project_id})
            if not project:
                return False
                
            version_history = project.get("version_history", [])
            if version_history is None:
                version_history = []
                
            file_entry = next((v for v in version_history if v.get("file_path") == request.file_path), None)
            if not file_entry:
                new_entry = {
                    "file_path": request.file_path,
                    "versions": [version]
                }
                await self.db.projects.update_one(
                    {"project_id": request.project_id},
                    {"$push": {"version_history": new_entry}}
                )
            else:
                await self.db.projects.update_one(
                    {"project_id": request.project_id, "version_history.file_path": request.file_path},
                    {"$push": {"version_history.$.versions": version}}
                )
            return True
        except Exception as e:
            print(f"[ERROR] failed to record file version: {e}")
            return False

    async def get_versions(self, project_id: str, file_path: str) -> List[Dict[str, Any]]:
        try:
            project = await self.db.projects.find_one(
                {"project_id": project_id},
                {"version_history": 1}
            )
            if not project:
                return []
            version_history = project.get("version_history", []) or []
            file_entry = next((v for v in version_history if v.get("file_path") == file_path), None)
            
            # Format timestamps to ISO format for JSON compatibility
            versions = file_entry.get("versions", []) if file_entry else []
            for v in versions:
                if isinstance(v.get("timestamp"), datetime):
                    v["timestamp"] = v["timestamp"].isoformat()
            return versions
        except Exception as e:
            print(f"[ERROR] failed to retrieve file versions: {e}")
            return []
