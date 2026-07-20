# backend/app/services/github_oauth.py
import httpx
import os
import secrets
from datetime import datetime
from fastapi import HTTPException
from app.models.user import CreateUserRequest, UserResponse
from app.auth.auth import create_access_token, get_password_hash
from motor.motor_asyncio import AsyncIOMotorDatabase
from uuid import uuid4

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "default_client_id")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "default_secret")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:5000/api/v1/auth/github/callback")

class GitHubOAuth:
    async def get_auth_url(self) -> str:
        """Generate GitHub OAuth authorization URL"""
        state = secrets.token_urlsafe(16)
        return (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={GITHUB_CLIENT_ID}"
            f"&redirect_uri={GITHUB_REDIRECT_URI}"
            f"&scope=user:email"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> str:
        """Exchange authorization code for access token using httpx"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GITHUB_REDIRECT_URI
                },
                headers={"Accept": "application/json"}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to retrieve token from GitHub")
            data = response.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=data.get("error_description", data["error"]))
            return data["access_token"]

    async def get_user_info(self, access_token: str) -> dict:
        """Get user info and resolve primary email using httpx"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to retrieve user profile from GitHub")
            user_data = response.json()
            
            # Fetch email if private/null in the profile
            if not user_data.get("email"):
                email_response = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if email_response.status_code == 200:
                    emails = email_response.json()
                    primary_email = next((e["email"] for e in emails if e["primary"]), None)
                    user_data["email"] = primary_email or (emails[0]["email"] if emails else f"{user_data['login']}@github.local")
            
            return user_data

    async def handle_callback(self, code: str, db: AsyncIOMotorDatabase):
        """Handle GitHub OAuth callback and user sync"""
        try:
            access_token = await self.exchange_code(code)
            github_user = await self.get_user_info(access_token)
            
            # Check if user exists by GitHub ID or username
            existing_user = await db.users.find_one({
                "$or": [
                    {"github_id": str(github_user["id"])},
                    {"github_username": github_user["login"]}
                ]
            })
            
            if not existing_user:
                # Create user
                user_req = CreateUserRequest(
                    name=github_user.get("name") or github_user["login"],
                    password=secrets.token_urlsafe(16),
                    email=github_user.get("email") or f"{github_user['login']}@github.local",
                    github_username=github_user["login"],
                    github_id=str(github_user["id"]),
                    github_access_token=access_token,
                    skill_level="beginner",
                    goal="learning"
                )
                user_data = user_req.model_dump()
                user_data["password_hash"] = get_password_hash(user_data.pop("password"))
                user_data["user_id"] = str(uuid4())
                user_data["total_projects"] = 0
                user_data["total_learning_days"] = 0
                user_data["created_at"] = datetime.utcnow()
                user_data["updated_at"] = datetime.utcnow()
                
                await db.users.insert_one(user_data)
                user = UserResponse(**user_data)
            else:
                update_data = {
                    "github_id": str(github_user["id"]),
                    "github_access_token": access_token,
                    "updated_at": datetime.utcnow()
                }
                await db.users.update_one(
                    {"_id": existing_user["_id"]},
                    {"$set": update_data}
                )
                # Fetch latest document
                updated_user = await db.users.find_one({"_id": existing_user["_id"]})
                user = UserResponse(**updated_user)
            
            # Generate JWT token
            token = create_access_token(data={"sub": user.user_id})
            
            return {
                "token": token,
                "user": user,
                "github_user": github_user
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"GitHub OAuth failed: {str(e)}"
            )
