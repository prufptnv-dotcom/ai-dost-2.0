import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from app.agent.core_loop import run_autonomous_loop
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class PromptRequest(BaseModel):
    userPrompt: str
    projectPath: Optional[str] = None
    projectId: Optional[str] = None
    projectFiles: Optional[List[dict]] = []

async def agent_generator(request: PromptRequest):
    """
    Generator function that yields Server-Sent Events (SSE) chunks
    matching the frontend's expected format.
    """
    def sse_chunk(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    try:
        # Send start event
        yield sse_chunk({"type": "start", "message": "🚀 Initiating Autonomous ReAct Engine..."})
        
        # Consume the generator from core_loop
        cwd = request.projectPath if request.projectPath else "."
        async for chunk_dict in run_autonomous_loop(request.userPrompt, cwd=cwd, max_iterations=10):
            yield sse_chunk(chunk_dict)

    except Exception as e:
        logger.error(f"Agent execution error: {e}")
        yield sse_chunk({"type": "error", "message": str(e)})

@router.post("/run")
async def run_agent(request: PromptRequest):
    """
    Endpoint for the AI Dost frontend AgentPanel.
    Returns a StreamingResponse of Server-Sent Events.
    """
    return StreamingResponse(
        agent_generator(request), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no" # Important for Nginx/proxies
        }
    )
