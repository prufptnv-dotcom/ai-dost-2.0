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
        
    if not token:
        await websocket.close(code=1008, reason="Authentication token missing")
        return
        
    try:
        current_user = await get_current_user(token, db)
    except Exception:
        await websocket.close(code=1008, reason="Authentication failed")
        return

    # Check authorization (is user a collaborator or project owner?)
    project = await db.projects.find_one({
        "project_id": project_id,
        "$or": [
            {"user_id": current_user.user_id},
            {"collaborators.user_id": current_user.user_id}
        ]
    })
    
    if not project:
        await websocket.close(code=1008, reason="Unauthorized user context")
        return

    collaboration_service = CollaborationService(db)
    
    # Initialize and join project channel
    await collaboration_service.create_project_channel(project_id)
    await collaboration_service.add_to_project_channel(project_id, websocket)
    
    try:
        # Send initial project data to newly connected client
        await websocket.send_text(json.dumps({
            "type": "project_init",
            "data": {
                "project_name": project.get("project_name"),
                "tech_stack": project.get("tech_stack", []),
                "collaborators": project.get("collaborators", [])
            }
        }))
        
        # Connection receive text loop
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                if data.get("type") == "document_update":
                    await collaboration_service.update_document(
                        project_id=project_id,
                        doc_id=data.get("doc_id"),
                        changes=data.get("changes", {})
                    )
            except json.JSONDecodeError:
                pass
                
    except Exception:
        pass
    finally:
        await collaboration_service.remove_from_project_channel(project_id, websocket)
        try:
            await websocket.close()
        except Exception:
            pass
