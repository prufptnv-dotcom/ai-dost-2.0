from fastapi import APIRouter, WebSocket
from app.services.llm_router import LLMRouter
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

llm_router = LLMRouter()

from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "auto"
    fileContent: Optional[str] = None
    section: Optional[str] = None
    history: Optional[list] = []

from app.core.llm_router import call_llm_with_fallback

@router.post("")
async def post_chat(request: ChatRequest):
    try:
        system_prompt = (
            "You are AI-Dost, an expert AI software developer and coding assistant. "
            "You are chatting with a user in their IDE. "
            "IMPORTANT RULES:\n"
            "1. If the user asks you to build, create, or make an app/project (e.g., 'banao'), you MUST write the complete code for it in a markdown code block so the user can use the 'Apply Code' button to put it in their editor.\n"
            "2. Do not just give a single question or text-based quiz if they ask to 'build a quiz'. Write an actual script or application.\n"
            "3. DO NOT generate markdown image links unless explicitly asked for an image.\n"
            "4. Be concise and friendly in Hindi or English."
        )
        if request.fileContent:
            system_prompt += f"\n\nContext - Current File Code:\n{request.fileContent}"
            
        reply = await call_llm_with_fallback(system_prompt, request.message, history=request.history)
        return {"success": True, "reply": reply}
    except Exception as e:
        logger.error(f"Chat POST error: {e}")
        return {"success": False, "reply": "Sorry, an error occurred while processing your request. Please check the backend logs."}

@router.get("/local-models")
async def get_local_models():
    # Placeholder for Ollama local models
    return {"success": True, "models": []}


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
