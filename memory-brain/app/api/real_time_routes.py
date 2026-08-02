# backend/app/api/real_time_routes.py
from fastapi import APIRouter, WebSocket, Depends, Query
from app.services.real_time import CollaborationService
from app.auth.auth import get_current_user
from app.models.user import UserResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from typing import Optional
import json

router = APIRouter(prefix="/realtime", tags=["Real-Time Collaboration"])

@router.websocket("/project/{project_id}")
async def project_collaboration(
    project_id: str,
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    await websocket.accept()
    
    # Try retrieving token from query parameters manually if not provided in headers
    if not token:
        token = websocket.query_params.get("token")
        
    user_id = "demo_user_id"
    user_name = "Collaborator"
    
    if token and token != "demo_token":
        try:
            current_user = await get_current_user(token, db)
            if current_user:
                user_id = current_user.user_id
                user_name = current_user.username or "Collaborator"
        except Exception:
            pass

    collaboration_service = CollaborationService(db)
    
    # Initialize and join project channel
    await collaboration_service.create_project_channel(project_id)
    await collaboration_service.add_to_project_channel(project_id, websocket)
    
    # Assign a random color for collaborator cursor
    colors = ["#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#f59e0b", "#3b82f6"]
    user_color = colors[hash(user_id) % len(colors)]

    try:
        # Send initial project data to newly connected client
        await websocket.send_text(json.dumps({
            "type": "project_init",
            "data": {
                "project_id": project_id,
                "user_id": user_id,
                "user_name": user_name,
                "user_color": user_color
            }
        }))
        
        # Broadcast user_joined to channel
        await collaboration_service.broadcast(project_id, {
            "type": "user_joined",
            "user_id": user_id,
            "user_name": user_name,
            "user_color": user_color
        })

        # Connection receive text loop
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "document_update":
                    await collaboration_service.update_document(
                        project_id=project_id,
                        doc_id=data.get("doc_id", "main.py"),
                        changes=data.get("changes", {})
                    )
                elif msg_type == "cursor_move":
                    await collaboration_service.broadcast(project_id, {
                        "type": "cursor_move",
                        "user_id": user_id,
                        "user_name": user_name,
                        "user_color": user_color,
                        "position": data.get("position", {})
                    })
            except json.JSONDecodeError:
                pass
                
    except Exception:
        pass
    finally:
        await collaboration_service.remove_from_project_channel(project_id, websocket)
        await collaboration_service.broadcast(project_id, {
            "type": "user_left",
            "user_id": user_id,
            "user_name": user_name
        })
        try:
            await websocket.close()
        except Exception:
            pass
