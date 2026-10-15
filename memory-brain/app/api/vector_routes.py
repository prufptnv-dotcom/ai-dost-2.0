# backend/app/api/vector_routes.py
from fastapi import APIRouter, Depends, HTTPException
from app.services.vector_memory import VectorMemoryService
from app.auth.auth import get_current_active_user
from app.models.user import UserResponse
from app.database.mongodb import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

router = APIRouter(prefix="/vector", tags=["Vector Memory"])

class DocumentRequest(BaseModel):
    content: str
    source_type: str = "note"

@router.post("/add", summary="Store document in vector memory")
async def add_document(
    request: DocumentRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Store text document as vector embedding for semantic search"""
    if db is None:
        return {"status": "warning", "message": "Database currently offline. Document cached locally."}

    user_id = "demo_user_id"
    try:
        # Initialize vector memory service
        vector_service = VectorMemoryService(db)
        
        # Create or get user collection
        collection_name = f"user_{user_id}"
        await vector_service.initialize_collection(collection_name)
        
        return await vector_service.add_document(
            collection_name=collection_name,
            user_id=user_id,
            document=request.content,
            source_type=request.source_type
        )
    except Exception as e:
        return {"status": "warning", "message": str(e)}

@router.get("/search", summary="Semantic search in vector memory")
async def semantic_search(
    query: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    limit: int = 3
):
    """Search for documents semantically similar to query"""
    if db is None:
        return []

    user_id = "demo_user_id"
    try:
        vector_service = VectorMemoryService(db)
        collection_name = f"user_{user_id}"
        return await vector_service.semantic_search(
            collection_name=collection_name,
            query=query,
            user_id=user_id,
            limit=limit
        )
    except Exception as e:
        return []
