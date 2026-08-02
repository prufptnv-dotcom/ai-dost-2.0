"""
MongoDB Async Client
-------------------
Motor is MongoDB's async driver.
Yeh FastAPI ke event loop ke saath compatible hai.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

class MongoDB:
    """Singleton pattern - ek hi database instance throughout app"""
    
    client: AsyncIOMotorClient = None  # MongoDB client
    db: AsyncIOMotorDatabase = None    # Database instance

    @classmethod
    async def connect(cls):
        """App startup pe call karna"""
        try:
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                maxPoolSize=20,      # Maximum 20 concurrent connections
                minPoolSize=5,       # Always maintain 5 connections
                serverSelectionTimeoutMS=1000  # 1 sec timeout
            )
            cls.db = cls.client[settings.DATABASE_NAME]
            # Test connection
            await cls.client.admin.command('ping')
            print(f"[OK] Connected to MongoDB: {settings.DATABASE_NAME}")
        except Exception as e:
            cls.client = None
            cls.db = None
            print(f"[WARNING] MongoDB connection failed (running in fallback mode): {e}")

    @classmethod
    async def close(cls):
        """Graceful shutdown"""
        if cls.client:
            cls.client.close()
            print("[INFO] MongoDB connection closed")

    @classmethod
    async def create_indexes(cls):
        """
        Performance ke liye indexes create karna.
        Har startup pe call hoga - idempotent operation hai.
        """
        if not cls.db:
            return
        try:
            # Users collection indexes
            await cls.db.users.create_index("user_id", unique=True)
            await cls.db.users.create_index("github_username", sparse=True)

            # Projects collection indexes
            await cls.db.projects.create_index("project_id", unique=True)
            await cls.db.projects.create_index([("user_id", 1), ("created_at", -1)])
            await cls.db.projects.create_index("project_name")

            # Learning logs indexes
            await cls.db.learning_logs.create_index([("user_id", 1), ("date", -1)])
            await cls.db.learning_logs.create_index([("user_id", 1), ("topic", 1)])

            print("[INFO] MongoDB indexes created successfully")
        except Exception as e:
            print(f"[WARNING] Error creating indexes: {e}")

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Database instance return karega - services me use hoga"""
        return cls.db


# Convenience function - services me direct use
async def get_database() -> AsyncIOMotorDatabase:
    return MongoDB.get_db()
