from fastapi import APIRouter, WebSocket, Depends
from app.services.agentic_ai import AgenticAI
from app.config.security import verify_token
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agentic", tags=["Agentic AI"])

agentic_ai = AgenticAI()

@router.websocket("/auto-complete")
async def auto_complete(websocket: WebSocket):
    try:
        await websocket.accept()
        async for code_stream in websocket.receive_json():
            if code_stream.get("action") == "start_autocomplete":
                result = await agentic_ai.monitor_and_autocomplete(code_stream)
                await websocket.send_json(result)
    except Exception as e:
        logger.error(f"Agentic autocomplete error: {e}")
