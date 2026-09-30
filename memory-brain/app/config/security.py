from fastapi import Request, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import os
from app.config.secret_key import get_secret_key

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

def verify_token(token: str):
    try:
        # #180: unified env-driven secret (hard-coded fallback removed)
        secret = get_secret_key()
        algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# In-memory Rate Limiter fallback if Redis instance is unreachable
_rate_limit_store = {}

def rate_limit(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    key = f"rate_limit:{client_ip}"
    limit = int(os.getenv("RATE_LIMIT", 100))
    
    current = _rate_limit_store.get(key, 0)
    if current >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    _rate_limit_store[key] = current + 1
