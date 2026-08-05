import redis.asyncio as aioredis
from app.config import settings
import json

class RedisCache:
    client: aioredis.Redis = None

    @classmethod
    async def connect(cls):
        try:
            cls.client = aioredis.from_url(
                settings.REDIS_URL, 
                decode_responses=True,
                socket_connect_timeout=5.0,
                socket_timeout=5.0,
                ssl_cert_reqs="none"
            )
            # Test ping
            await cls.client.ping()
            print(f"[OK] Connected to Redis successfully: {settings.REDIS_URL}")
        except Exception as e:
            cls.client = None
            print(f"[WARNING] Redis connection failed (running in cache-bypass mode): {e}")

    @classmethod
    async def close(cls):
        if cls.client:
            await cls.client.close()
            print("[INFO] Redis connection closed")

    @classmethod
    async def get(cls, key: str):
        if not cls.client:
            return None
        try:
            value = await cls.client.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            print(f"[WARNING] Redis get error: {e}")
            return None

    @classmethod
    async def set(cls, key: str, value: any, expire: int = 3600):
        if not cls.client:
            return False
        try:
            serialized = json.dumps(value)
            await cls.client.set(key, serialized, ex=expire)
            return True
        except Exception as e:
            print(f"[WARNING] Redis set error: {e}")
            return False

    @classmethod
    async def delete(cls, key: str):
        if not cls.client:
            return False
        try:
            await cls.client.delete(key)
            return True
        except Exception as e:
            print(f"[WARNING] Redis delete error: {e}")
            return False
