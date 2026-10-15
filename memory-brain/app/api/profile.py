# backend/app/api/profile.py
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.services.profile_service import ProfileService
from app.models.user import CreateUserRequest, UserResponse

router = APIRouter(prefix="/profile", tags=["Profile"])

@router.post("/", response_model=UserResponse, summary="Create a new user profile")
async def create_user_profile(
    request: CreateUserRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new user profile with basic details"""
    profile_service = ProfileService(db)
    try:
        return await profile_service.create_profile(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{user_id}", response_model=UserResponse, summary="Get user profile by ID")
async def get_user_profile(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve user profile by unique ID"""
    profile_service = ProfileService(db)
    try:
        return await profile_service.get_profile(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{user_id}", response_model=UserResponse, summary="Update user profile")
async def update_user_profile(
    user_id: str,
    updates: dict,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update specific fields in a user profile"""
    profile_service = ProfileService(db)
    try:
        return await profile_service.update_profile(user_id, updates)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
