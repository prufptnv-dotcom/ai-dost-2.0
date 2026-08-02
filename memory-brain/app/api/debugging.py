from fastapi import APIRouter, WebSocket
from app.services.debugging import DebuggingService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/debugging", tags=["Debugging"])

debugging_service = DebuggingService()

@router.websocket("/error_hook")
async def error_hook(websocket: WebSocket):
    try:
        await websocket.accept()
        while True:
            error_data = await websocket.receive_json()
            result = await debugging_service.analyze_error(error_data)
            await websocket.send_json(result)
    except Exception as e:
        logger.error(f"Error hook error: {e}")
