# backend/app/services/learning_service.py
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.learning_log import LearningLogRequest, LearningLogResponse

class LearningService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.learning_logs

    async def log_learning(self, user_id: str, log: LearningLogRequest) -> LearningLogResponse:
        log_data = log.model_dump()
        log_data["user_id"] = user_id
        log_data["created_at"] = datetime.utcnow()
        result = await self.collection.insert_one(log_data)
        return LearningLogResponse(**log_data)

    async def get_daily_report(self, user_id: str) -> dict:
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        # Convert date objects to datetime for comparison in MongoDB if stored as ISODate
        # Or compare dates if stored as native date types.
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "date": {
                    "$gte": datetime.combine(yesterday, datetime.min.time()),
                    "$lt": datetime.combine(today, datetime.min.time())
                }
            }},
            {"$group": {
                "_id": None,
                "topics": {"$push": "$topic"},
                "total_time": {"$sum": 1},
                "avg_confidence": {"$avg": "$confidence_level"},
                "mistakes": {"$sum": {"$size": "$mistakes"}}
            }}
        ]
        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=1)
        return results[0] if results else {}

    async def track_mistake(self, user_id: str, mistake: dict) -> dict:
        # Find similar past mistakes
        cursor = self.collection.find({
            "user_id": user_id,
            "mistakes.description": mistake["description"]
        }).limit(3)
        similar = await cursor.to_list(length=3)
        
        # Update recurrence count
        if similar:
            for doc in similar:
                await self.collection.update_one(
                    {"_id": doc["_id"], "mistakes.description": mistake["description"]},
                    {"$inc": {"mistakes.$.recurrence_count": 1}}
                )
        
        return {"total_similar": len(similar), "updated": len(similar)}
