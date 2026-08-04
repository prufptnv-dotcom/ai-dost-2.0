"""
Configuration Manager
-----------------------
Saare env variables ek jagah.
Pydantic Settings auto .env file se load karti hai.
"""
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 🔴 MongoDB Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "ai_dost_memory"  # Database name

    # 🔴 Redis Configuration
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_CACHE_TTL: int = 3600  # 1 hour cache expiry

    # 🔴 ChromaDB Configuration
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000  # Custom port (default 8000)
    CHROMA_PERSIST_DIR: str = "./chroma_data"  # Vector DB storage location

    # 🔴 Embedding Model
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"  # 384-dim, fast
    EMBEDDING_DIMENSION: int = 384  # Output vector size

    # 🔴 API Configuration
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Ai-Dost Memory Brain"
    VERSION: str = "1.0.0"
    
    # 🔴 CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"

    # 🔴 JWT Configuration
    SECRET_KEY: str = "super_secret_key_for_ai_dost_memory_brain_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days in minutes

    # 🔴 Optional - Sentry/Logging
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"

    # 🔴 LLM API Keys
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None

    # Pydantic V2 style config
    model_config = {
        "env_file": ".env",  # Auto-load from .env file
        "case_sensitive": True,
        "extra": "allow"  # Allow extra env vars
    }

# Single global instance
settings = Settings()

# Print config on startup (helpful for debugging)
def print_config():
    print(f"📦 MongoDB: {settings.MONGODB_URL}")
    print(f"🗄️  Database: {settings.DATABASE_NAME}")
    print(f"⚡ Redis: {settings.REDIS_URL}")
    print(f"🧬 ChromaDB: {settings.CHROMA_HOST}:{settings.CHROMA_PORT}")
    print(f"📐 Embeddings: {settings.EMBEDDING_MODEL}")
