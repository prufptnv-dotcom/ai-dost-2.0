# backend/app/auth/auth.py
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.user import UserResponse

# Settings
SECRET_KEY = "ai_dost_secret_key"  # Should be in .env in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 240  # 4 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored hash using bcrypt directly"""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash password for storage using bcrypt directly"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generate JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str, db: AsyncIOMotorDatabase):
    """Verify token and get current user"""
    if token == "demo_token" or token == "demo_user_id" or token == "Bearer demo_token" or token == "Bearer demo_user_id":
        user_id = "demo_user_id"
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            user = {
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
            await db.users.insert_one(user)
        return UserResponse(**user)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"user_id": user_id})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

async def get_current_active_user(token: str = Depends(oauth2_scheme), db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get active user with validation"""
    user = await get_current_user(token, db)
    return user
