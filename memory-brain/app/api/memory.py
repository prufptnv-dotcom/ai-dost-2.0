# backend/app/api/memory.py
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.services.memory_service import MemoryService
from app.models.project import ProjectRequest, ProjectResponse
from app.models.user import UserResponse
from app.database.redis import RedisCache
from uuid import uuid4
from datetime import datetime
from app.auth.auth import get_current_active_user
from app.services.version_history import VersionHistoryService, VersionHistoryRequest

router = APIRouter(prefix="/memory", tags=["Memory"])

@router.post("/project", response_model=ProjectResponse, summary="Create a new project context")
async def create_project_context(
    project: ProjectRequest,
    user_id: str,  # Added user_id as query param for simplicity
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    """Create a new project with intelligent context building"""
    project_data = project.model_dump()
    project_data["user_id"] = user_id
    project_data["project_id"] = str(uuid4())
    project_data["created_at"] = datetime.utcnow()
    project_data["updated_at"] = datetime.utcnow()

    if db is None:
        return ProjectResponse(**project_data)

    mem_service = MemoryService(db)
    
    # Get user profile
    user_data = await db.users.find_one({"user_id": user_id})
    if not user_data:
        user_data = {
            "user_id": user_id,
            "name": "Demo User",
            "skill_level": "intermediate",
            "current_stack": [],
            "learning_goals": ["FastAPI", "React"],
            "preferences": {
                "favorite_colors": ["blue"],
                "coding_style": "clean_code",
                "naming_convention": "PascalCase",
                "editor": "VS Code",
                "theme": "dark"
            },
            "hardware_specs": {
                "ram": "16GB",
                "os": "Windows"
            },
            "daily_coding_hours": 2.0,
            "project_type": "solo",
            "goal": "learning",
            "total_projects": 0,
            "total_learning_days": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.users.insert_one(user_data)
    user = UserResponse(**user_data)
    
    # Build context and create project
    context = await mem_service.build_context(user, project)
    
    result = await db.projects.insert_one(project_data)
    await RedisCache.delete(f"projects:{user_id}")
    return ProjectResponse(**project_data)

@router.post("/search", summary="Semantic search user memories")
async def search(
    query: str,
    user_id: str,
    limit: int = 5,
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    """Retrieve semantically relevant documents using vector search"""
    mem_service = MemoryService(db)
    return await mem_service.semantic_search(query=query, user_id=user_id, limit=limit)

@router.post("/add-document", summary="Index document to vector store")
async def add_document(
    user_id: str,
    content: str,
    doc_id: str,
    metadata: dict = None
):
    """Generate embedding and add text to local ChromaDB collection"""
    from app.services.vector_service import VectorService
    try:
        await VectorService.add_memory(user_id=user_id, content=content, doc_id=doc_id, metadata=metadata)
        return {"success": True, "message": "Document indexed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects", summary="Get all projects for a user")
async def get_projects(
    user_id: str,
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    """Retrieve all projects created by a specific user"""
    cache_key = f"projects:{user_id}"
    cached = await RedisCache.get(cache_key)
    if cached is not None:
        return cached

    if db is None:
        return []

    mem_service = MemoryService(db)
    projects = await mem_service.get_projects(user_id)
    await RedisCache.set(cache_key, projects, 300)
    return projects

@router.get("/project/{project_id}", summary="Get project details by project ID")
async def get_project(
    project_id: str,
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    """Retrieve metadata and files for a specific project"""
    cache_key = f"project:{project_id}"
    cached = await RedisCache.get(cache_key)
    if cached is not None:
        return cached

    fallback_project = {
        "project_id": project_id,
        "user_id": "demo_user_id",
        "project_name": "AI Dost Workspace",
        "description": "Interactive Development Sandbox & AI Copilot Workspace",
        "status": "Development",
        "files": [
            { "path": "main.py", "content": "# Write python code here...\nprint('Hello from AI-Dost Workspace!')\n" },
            { "path": "index.html", "content": "<!DOCTYPE html>\n<html>\n<head>\n  <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n  <div className=\"container\">\n    <h1>Welcome to AI-Dost Sandbox</h1>\n    <p>AI Copilot Workspace is active and ready!</p>\n  </div>\n</body>\n</html>\n" },
            { "path": "style.css", "content": "body {\n  background: #05060a;\n  color: #06b6d4;\n  font-family: sans-serif;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  margin: 0;\n}\n.container {\n  text-align: center;\n  border: 1px solid rgba(6, 182, 212, 0.2);\n  padding: 32px;\n  border-radius: 16px;\n  background: rgba(14, 16, 24, 0.8);\n}\n" }
        ]
    }

    if db is None:
        return fallback_project

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        return fallback_project

    if "_id" in project:
        project["_id"] = str(project["_id"])
    await RedisCache.set(cache_key, project, 300)
    return project

from pydantic import BaseModel

class FileActionRequest(BaseModel):
    file_path: str
    content: Optional[str] = ""

@router.post("/project/{project_id}/file", summary="Add file to project")
async def add_project_file(
    project_id: str,
    request: FileActionRequest,
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    if db is None:
        return {"success": True, "file": {"path": request.file_path, "content": request.content or ""}}

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        return {"success": True, "file": {"path": request.file_path, "content": request.content or ""}}
    
    files = project.get("files", [])
    if files is None:
        files = []
        
    if any(f.get("path") == request.file_path for f in files):
        return {"success": True, "file": {"path": request.file_path, "content": request.content or ""}}
        
    new_file = {"path": request.file_path, "content": request.content or ""}
    await db.projects.update_one(
        {"project_id": project_id},
        {"$push": {"files": new_file}, "$set": {"updated_at": datetime.utcnow()}}
    )
    await RedisCache.delete(f"project:{project_id}")
    return {"success": True, "file": new_file}

@router.delete("/project/{project_id}/file", summary="Delete file from project")
async def delete_project_file(
    project_id: str,
    file_path: str,
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    if db is None:
        return {"success": True}

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        return {"success": True}
        
    await db.projects.update_one(
        {"project_id": project_id},
        {"$pull": {"files": {"path": file_path}}, "$set": {"updated_at": datetime.utcnow()}}
    )
    await RedisCache.delete(f"project:{project_id}")
    return {"success": True}

@router.put("/project/{project_id}/file", summary="Save file content")
async def save_project_file(
    project_id: str,
    request: FileActionRequest,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Optional[AsyncIOMotorDatabase] = Depends(get_database)
):
    if db is None:
        return {"success": True}

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        return {"success": True}
        
    # Check if files array contains this file path, if not we add it, if yes we update it
    files = project.get("files", [])
    if files is None:
        files = []
        
    if not any(f.get("path") == request.file_path for f in files):
        # File doesn't exist yet, push it
        new_file = {"path": request.file_path, "content": request.content or ""}
        await db.projects.update_one(
            {"project_id": project_id},
            {"$push": {"files": new_file}, "$set": {"updated_at": datetime.utcnow()}}
        )
    else:
        # File exists, update content
        await db.projects.update_one(
            {"project_id": project_id, "files.path": request.file_path},
            {"$set": {"files.$.content": request.content, "updated_at": datetime.utcnow()}}
        )
        
    # Record version checkpoint snapshot in background
    try:
        history_service = VersionHistoryService(db)
        await history_service.record_version(
            VersionHistoryRequest(
                project_id=project_id,
                file_path=request.file_path,
                content=request.content or "",
                user_id=current_user.user_id if current_user else "demo_user_id"
            )
        )
    except Exception:
        pass
        
    await RedisCache.delete(f"project:{project_id}")
    return {"success": True}

@router.get("/project/{project_id}/file/versions", summary="Get versions history list for a file")
async def get_project_file_versions(
    project_id: str,
    file_path: str,
    current_user: UserResponse = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve all historical snapshots for a given file"""
    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    history_service = VersionHistoryService(db)
    return await history_service.get_versions(project_id, file_path)
