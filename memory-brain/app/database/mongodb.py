"""
MongoDB Async Client with In-Memory Fallback
-------------------
Motor is MongoDB's async driver.
Yeh FastAPI ke event loop ke saath compatible hai.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

import json
import os

DB_DIR = os.path.join(os.getcwd(), ".data")
os.makedirs(DB_DIR, exist_ok=True)

class InMemoryAsyncCollection:
    def __init__(self, name):
        self.name = name
        self._data = []
        self._filepath = os.path.join(DB_DIR, f"{name}.json")
        self._load_from_disk()

    def _load_from_disk(self):
        if os.path.exists(self._filepath):
            try:
                with open(self._filepath, 'r', encoding='utf-8') as f:
                    self._data = json.load(f)
            except Exception as e:
                print(f"[WARNING] Could not load data from {self._filepath}: {e}")

    def _save_to_disk(self):
        try:
            with open(self._filepath, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, indent=2, default=str)
        except Exception as e:
            print(f"[WARNING] Could not save data to {self._filepath}: {e}")

    def _matches(self, doc, filter):
        if not filter:
            return True
        if "$or" in filter:
            or_conditions = filter["$or"]
            other_filter = {k: v for k, v in filter.items() if k != "$or"}
            if not self._matches(doc, other_filter):
                return False
            return any(self._matches(doc, cond) for cond in or_conditions)
        for k, v in filter.items():
            if k == "files.path":
                files = doc.get("files", [])
                if not any(f.get("path") == v for f in files if isinstance(f, dict)):
                    return False
            elif doc.get(k) != v:
                return False
        return True

    async def insert_one(self, document):
        doc = dict(document)
        self._data.append(doc)
        self._save_to_disk()
        class InsertResult:
            inserted_id = doc.get("_id", "mock_id")
        return InsertResult()

    async def find_one(self, filter=None, projection=None):
        filter = filter or {}
        for doc in self._data:
            if self._matches(doc, filter):
                return dict(doc)
        return None

    def find(self, filter=None):
        filter = filter or {}
        results = [dict(doc) for doc in self._data if self._matches(doc, filter)]
        
        class AsyncCursor:
            def __init__(self, data):
                self.data = data
            def sort(self, *args, **kwargs):
                return self
            def limit(self, *args, **kwargs):
                return self
            async def to_list(self, length=None):
                return self.data
            def __aiter__(self):
                self._iter = iter(self.data)
                return self
            async def __anext__(self):
                try:
                    return next(self._iter)
                except StopIteration:
                    raise StopAsyncIteration
        return AsyncCursor(results)

    def aggregate(self, pipeline=None):
        pipeline = pipeline or []
        filter = {}
        for stage in pipeline:
            if "$match" in stage:
                filter.update(stage["$match"])
        
        results = [dict(doc) for doc in self._data if self._matches(doc, filter)]
        
        class AsyncCursor:
            def __init__(self, data):
                self.data = data
            async def to_list(self, length=None):
                return self.data
            def __aiter__(self):
                self._iter = iter(self.data)
                return self
            async def __anext__(self):
                try:
                    return next(self._iter)
                except StopIteration:
                    raise StopAsyncIteration
        return AsyncCursor(results)

    async def update_one(self, filter, update, upsert=False):
        filter = filter or {}
        target = None
        for doc in self._data:
            if self._matches(doc, filter):
                target = doc
                break
        
        if target is None and upsert:
            target = dict(filter)
            self._data.append(target)

        if target is not None:
            if "$set" in update:
                for k, v in update["$set"].items():
                    if "files.$.content" in k or k.startswith("files."):
                        elem_path = filter.get("files.path")
                        if "files" in target and isinstance(target["files"], list):
                            for f in target["files"]:
                                if isinstance(f, dict) and f.get("path") == elem_path:
                                    f["content"] = v
                                    if "updated_at" in update["$set"]:
                                        f["updated_at"] = update["$set"]["updated_at"]
                    else:
                        target[k] = v
            if "$push" in update:
                for k, v in update["$push"].items():
                    if k not in target or not isinstance(target[k], list):
                        target[k] = []
                    target[k].append(v)
            if "$pull" in update:
                for k, v in update["$pull"].items():
                    if k in target and isinstance(target[k], list):
                        pull_path = v.get("path") if isinstance(v, dict) else v
                        target[k] = [item for item in target[k] if (item.get("path") if isinstance(item, dict) else item) != pull_path]
            self._save_to_disk()

        class UpdateResult:
            matched_count = 1 if target else 0
            modified_count = 1 if target else 0
        return UpdateResult()

    async def delete_one(self, filter):
        filter = filter or {}
        for i, doc in enumerate(self._data):
            if self._matches(doc, filter):
                self._data.pop(i)
                self._save_to_disk()
                class DeleteResult:
                    deleted_count = 1
                return DeleteResult()
        class DeleteResult:
            deleted_count = 0
        return DeleteResult()

    async def create_index(self, *args, **kwargs):
        pass

class InMemoryAsyncDatabase:
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name not in self._collections:
            self._collections[name] = InMemoryAsyncCollection(name)
        return self._collections[name]

    def __getitem__(self, name):
        return getattr(self, name)

class MongoDB:
    """Singleton pattern - ek hi database instance throughout app"""
    
    client = None  # MongoDB client
    db = None      # Database instance

    @classmethod
    async def connect(cls):
        """App startup pe call karna"""
        try:
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                maxPoolSize=20,
                minPoolSize=5,
                serverSelectionTimeoutMS=500  # 0.5 sec fast timeout
            )
            cls.db = cls.client[settings.DATABASE_NAME]
            await cls.client.admin.command('ping')
            print(f"[OK] Connected to MongoDB: {settings.DATABASE_NAME}")
        except Exception as e:
            cls.client = None
            cls.db = InMemoryAsyncDatabase()
            print(f"[WARNING] MongoDB connection failed (running in fallback in-memory mode): {e}")

    @classmethod
    async def close(cls):
        """Graceful shutdown"""
        if cls.client:
            cls.client.close()
            print("[INFO] MongoDB connection closed")

    @classmethod
    async def create_indexes(cls):
        if cls.db is None or isinstance(cls.db, InMemoryAsyncDatabase):
            return
        try:
            await cls.db.users.create_index("user_id", unique=True)
            await cls.db.users.create_index("github_username", sparse=True)
            await cls.db.projects.create_index("project_id", unique=True)
            await cls.db.projects.create_index([("user_id", 1), ("created_at", -1)])
            await cls.db.projects.create_index("project_name")
            await cls.db.learning_logs.create_index([("user_id", 1), ("date", -1)])
            await cls.db.learning_logs.create_index([("user_id", 1), ("topic", 1)])
            print("[INFO] MongoDB indexes created successfully")
        except Exception as e:
            print(f"[WARNING] Error creating indexes: {e}")

    @classmethod
    def get_db(cls):
        return cls.db

async def get_database():
    return MongoDB.get_db()
