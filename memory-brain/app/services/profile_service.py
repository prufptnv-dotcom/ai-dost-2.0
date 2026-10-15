# backend/app/services/profile_service.py
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.auth.auth import get_password_hash
from app.models.user import CreateUserRequest, UserResponse

class ProfileService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users

    async def create_profile(self, request: CreateUserRequest) -> UserResponse:
        # Check if user already exists by GitHub username
        existing = None
        if request.github_username:
            existing = await self.users_collection.find_one(
                {"github_username": request.github_username}
            )
        if existing:
            raise ValueError("User already exists with this GitHub profile")

        user_data = request.model_dump()
        # Securely hash the password
        password = user_data.pop("password")
        user_data["password_hash"] = get_password_hash(password)
        user_data["user_id"] = str(uuid4())
        user_data["total_projects"] = 0
        user_data["total_learning_days"] = 0
        user_data["created_at"] = datetime.utcnow()
        user_data["updated_at"] = datetime.utcnow()

        result = await self.users_collection.insert_one(user_data)
        return UserResponse(**user_data)

    async def get_profile(self, user_id: str) -> UserResponse:
        user = await self.users_collection.find_one({"user_id": user_id})
        if not user:
            raise ValueError("User not found")
        return UserResponse(**user)

    async def update_profile(self, user_id: str, updates: dict) -> UserResponse:
        update_data = {"$set": updates}
        result = await self.users_collection.update_one(
            {"user_id": user_id}, update_data
        )
        if result.matched_count == 0:
            raise ValueError("User not found")
        return await self.get_profile(user_id)
