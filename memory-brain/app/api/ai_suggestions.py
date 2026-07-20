from fastapi import APIRouter, Depends, HTTPException
from app.services.ai_code_suggestions import CodeSuggestionRequest, CodeSuggestionResponse, AICodeSuggestionService
from app.auth.auth import get_current_active_user
from app.models.user import UserResponse
from app.database.mongodb import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/ai", tags=["AI Suggestions"])

@router.post("/code-suggestions", response_model=CodeSuggestionResponse, summary="Get AI-powered code suggestions")
async def get_code_suggestions(
    request: CodeSuggestionRequest,
    current_user: UserResponse = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Generate AI-powered code completions and context suggestions"""
    try:
        suggestion_service = AICodeSuggestionService(db)
        return await suggestion_service.get_suggestions(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
