from fastapi import APIRouter, WebSocket
from app.services.vector_db import VectorDBService
from app.services.llm_router import LLMRouter
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/suggestions", tags=["Suggestions"])

vector_db_service = VectorDBService()
llm_router = LLMRouter()

def format_context_results(results: list[dict]) -> str:
    formatted = []
    for i, result in enumerate(results, 1):
        file_name = result.get('metadata', {}).get('file', 'file')
        formatted.append(f"{i}. {file_name}\n{result.get('text', '')}")
    return "\n".join(formatted)

@router.websocket("/realtime")
async def realtime_suggestions(websocket: WebSocket):
    try:
        await websocket.accept()
        async for message in websocket.receive_json():
            query = message.get("query", "")
            context = message.get("context", "")
            
            context_results = vector_db_service.query_context(f"{query} {context}")
            
            completion_text = f"// Code suggestion for: {query}\n\ndef suggested_function():\n    pass\n"
            
            for token in completion_text.split():
                await websocket.send_text(token + " ")
                await asyncio.sleep(0.05)
    except Exception as e:
        logger.error(f"Realtime suggestions error: {e}")
