# backend/app/api/learning.py
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.services.learning_service import LearningService
from app.models.learning_log import LearningLogRequest, LearningLogResponse

router = APIRouter(prefix="/learning", tags=["Learning"])

@router.post("/log", response_model=LearningLogResponse, summary="Log learning activity")
async def log_learning_activity(
    log: LearningLogRequest,
    user_id: str,  # Query param for user ID
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Record daily learning activities and progress"""
    learning_service = LearningService(db)
    return await learning_service.log_learning(user_id, log)

@router.get("/report", summary="Get daily learning report")
async def get_daily_learning_report(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Generate daily learning report with metrics"""
    learning_service = LearningService(db)
    return await learning_service.get_daily_report(user_id)

@router.post("/mistake", summary="Track coding mistakes and solutions")
async def track_mistake(
    mistake: dict,
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Record mistakes and automatically find similar past issues"""
    learning_service = LearningService(db)
    return await learning_service.track_mistake(user_id, mistake)
