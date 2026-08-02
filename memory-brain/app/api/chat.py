from fastapi import APIRouter, WebSocket
from app.services.llm_router import LLMRouter
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

llm_router = LLMRouter()

@router.websocket("/conversational")
async def conversational_chat(websocket: WebSocket):
    try:
        await websocket.accept()
        conversation_history = []
        
        async for message in websocket.receive_json():
            user_input = message.get("message", "")
            conversation_history.append({"role": "user", "content": user_input})
            
            bot_response = f"AI-Dost Assistant: I received your message: '{user_input}'. How can I help you build your project?"
            conversation_history.append({"role": "assistant", "content": bot_response})
            
            for token in bot_response.split():
                await websocket.send_text(token + " ")
                await asyncio.sleep(0.04)
    except Exception as e:
        logger.error(f"Chat error: {e}")
