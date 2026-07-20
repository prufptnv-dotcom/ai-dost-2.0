# backend/app/main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from app.config import settings
from app.api.profile import router as profile_router
from app.api.memory import router as memory_router
from app.api.learning import router as learning_router
from app.api.auth_routes import router as auth_router
from app.api.sandbox_routes import router as sandbox_router
from app.api.vector_routes import router as vector_router
from app.api.real_time_routes import router as real_time_router
from app.api.github_routes import router as github_router
from app.api.ai_suggestions import router as suggestions_router
from app.auth.auth import get_current_active_user
from app.models.user import UserResponse
from app.database.mongodb import MongoDB
from app.database.redis import RedisCache

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup database connection
    await MongoDB.connect()
    await MongoDB.create_indexes()
    await RedisCache.connect()
    yield
    # Shutdown connection
    await MongoDB.close()
    await RedisCache.close()

app = FastAPI(
    title="Ai-Dost Master Brain API",
    description="Personal Engineering Partner for Developers",
    version="1.0.0",
    terms_of_service="https://ai-dost.readthedocs.io",
    contact={
        "name": "Ai-Dost Team",
        "url": "https://ai-dost.dev/contact"
    },
    lifespan=lifespan,
)

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(profile_router, prefix=settings.API_V1_PREFIX)
app.include_router(memory_router, prefix=settings.API_V1_PREFIX)
app.include_router(learning_router, prefix=settings.API_V1_PREFIX)
app.include_router(sandbox_router, prefix=settings.API_V1_PREFIX)
app.include_router(vector_router, prefix=settings.API_V1_PREFIX)
app.include_router(real_time_router, prefix=settings.API_V1_PREFIX)
app.include_router(github_router, prefix=settings.API_V1_PREFIX)
app.include_router(suggestions_router, prefix=settings.API_V1_PREFIX)

# Root API
@app.get("/")
async def read_root(current_user: UserResponse = Depends(get_current_active_user)):
    """Root endpoint showing authentication integration"""
    return {
        "message": "Welcome to Ai-Dost Master Brain API",
        "user": current_user,
        "status": "authenticated"
    }
