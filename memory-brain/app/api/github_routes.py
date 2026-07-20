# backend/app/api/github_routes.py
from fastapi import APIRouter, Depends, HTTPException
from app.services.github_oauth import GitHubOAuth
from app.database.mongodb import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.user import UserResponse

router = APIRouter(prefix="/auth/github", tags=["GitHub OAuth"])

github_oauth = GitHubOAuth()

@router.get("/login", summary="Start GitHub OAuth flow")
async def start_github_login():
    """Redirect to GitHub authorization URL"""
    return {"authorization_url": await github_oauth.get_auth_url()}

@router.get("/callback", summary="Handle GitHub OAuth callback")
async def github_callback(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Handle GitHub OAuth callback and create JWT token"""
    try:
        result = await github_oauth.handle_callback(code, db)
        return {
            "token": result["token"],
            "github_user": result["github_user"],
            "user": result["user"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
