from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import os
import logging
from jose import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def create_access_token(data: dict, expires_delta: timedelta = None):
    try:
        to_encode = data.copy()
        if expires_delta:
            to_encode.update({"exp": datetime.utcnow() + expires_delta})
        secret = os.getenv("JWT_SECRET_KEY", "ai_dost_super_secret_jwt_key_2026")
        algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        encoded_jwt = jwt.encode(to_encode, secret, algorithm=algorithm)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Token creation failed: {e}")
        raise RuntimeError("Token creation failed") from e

@router.post("/token")
async def login():
    try:
        user = {"sub": "developer_user"}
        token = create_access_token(data=user, expires_delta=timedelta(minutes=60))
        return {"access_token": token, "token_type": "bearer"}
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")
