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

import time
from fastapi import Request

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Response-Time-Ms"] = str(process_time_ms)
    return response

from app.api.agentic import router as agentic_router
from app.api.suggestions import router as suggestions_ws_router
from app.api.chat import router as chat_ws_router
from app.api.debugging import router as debugging_ws_router

from app.api.git_routes import router as git_local_router

# Include routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(profile_router, prefix=settings.API_V1_PREFIX)
app.include_router(memory_router, prefix=settings.API_V1_PREFIX)
app.include_router(learning_router, prefix=settings.API_V1_PREFIX)
app.include_router(git_local_router, prefix=settings.API_V1_PREFIX)
app.include_router(sandbox_router, prefix=settings.API_V1_PREFIX)
app.include_router(vector_router, prefix=settings.API_V1_PREFIX)
app.include_router(real_time_router, prefix=settings.API_V1_PREFIX)
app.include_router(github_router, prefix=settings.API_V1_PREFIX)
app.include_router(suggestions_router, prefix=settings.API_V1_PREFIX)

# Include AI Coding Assistant Copilot Routers
from app.api.agent_routes import router as ai_agent_router
app.include_router(ai_agent_router, prefix="/api/agent")

app.include_router(agentic_router)
app.include_router(suggestions_ws_router)
app.include_router(chat_ws_router)
app.include_router(debugging_ws_router)

# Root API
@app.get("/")
async def read_root(current_user: UserResponse = Depends(get_current_active_user)):
    """Root endpoint showing authentication integration"""
    return {
        "message": "Welcome to Ai-Dost Master Brain API",
        "user": current_user,
        "status": "authenticated"
    }
