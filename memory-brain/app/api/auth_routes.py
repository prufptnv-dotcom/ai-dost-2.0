# backend/app/api/auth_routes.py
from fastapi import APIRouter, Depends, HTTPException
from app.auth.auth import (
    create_access_token,
    get_current_active_user,
    get_password_hash,
    verify_password
)
from app.models.user import CreateUserRequest, UserResponse
from app.database.mongodb import get_database
from datetime import timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/register", response_model=UserResponse)
async def register_user(
    user: CreateUserRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create new user with password protection"""
    # Check if user exists by GitHub username
    if user.github_username:
        existing = await db.users.find_one({"github_username": user.github_username})
        if existing:
            raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash password
    user_dict = user.model_dump()
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password", ""))
    user_dict["user_id"] = str(uuid4())
    user_dict["total_projects"] = 0
    user_dict["total_learning_days"] = 0
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    
    # Create user
    result = await db.users.insert_one(user_dict)
    return UserResponse(**user_dict)

@router.post("/login", summary="Get access token")
async def login(
    req: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Authenticate user and return JWT token"""
    user = await db.users.find_one({"$or": [{"github_username": req.username}, {"name": req.username}]})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=240)
    access_token = create_access_token(
        data={"sub": user["user_id"]},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": user["user_id"]}
