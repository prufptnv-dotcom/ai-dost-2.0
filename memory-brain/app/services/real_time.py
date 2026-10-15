# backend/app/services/real_time.py
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import WebSocket
import json
import asyncio

class CollaborationService:
    # Class-level connection trackers to survive recreation across API invocations
    active_connections: Dict[str, List[WebSocket]] = {}
    project_channels: Dict[str, List[WebSocket]] = {}

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def register_user_connection(self, user_id: str, websocket: WebSocket):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        try:
            while True:
                message = await websocket.receive_text()
                if message == "close":
                    break
        finally:
            self.active_connections[user_id] = [
                ws for ws in self.active_connections.get(user_id, [])
                if ws != websocket
            ]

    async def broadcast(self, project_id: str, message: Dict):
        channel = self.project_channels.get(project_id)
        if channel:
            for ws in channel:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    # Stale connection cleanup
                    pass

    async def create_project_channel(self, project_id: str):
        if project_id not in self.project_channels:
            self.project_channels[project_id] = []
        
    async def add_to_project_channel(self, project_id: str, websocket: WebSocket):
        if project_id not in self.project_channels:
            self.project_channels[project_id] = []
        self.project_channels[project_id].append(websocket)

    async def remove_from_project_channel(self, project_id: str, websocket: WebSocket):
        if project_id in self.project_channels:
            self.project_channels[project_id] = [
                ws for ws in self.project_channels[project_id]
                if ws != websocket
            ]

    async def get_project_collaborators(self, project_id: str) -> List[Dict]:
        project = await self.db.projects.find_one({"project_id": project_id})
        if project and "collaborators" in project:
            return project["collaborators"]
        return []

    async def update_document(self, project_id: str, doc_id: str, changes: Dict):
        # Update document in MongoDB
        await self.db.project_documents.update_one(
            {"project_id": project_id, "doc_id": doc_id},
            {"$set": changes},
            upsert=True
        )
        
        # Broadcast changes to all collaborators
        await self.broadcast(project_id, {
            "type": "document_update",
            "doc_id": doc_id,
            "changes": changes
        })
