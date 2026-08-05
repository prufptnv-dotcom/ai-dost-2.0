import pytest
from httpx import AsyncClient
from app.main import app
from unittest.mock import patch

@pytest.mark.asyncio
@patch("app.api.chat.call_llm_with_fallback")
async def test_chat_endpoint(mock_call_llm):
    mock_call_llm.return_value = "Mocked LLM Response"
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/chat",
            json={"message": "Hello AI", "model": "auto", "history": []}
        )
        
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["reply"] == "Mocked LLM Response"

@pytest.mark.asyncio
@patch("app.api.chat.call_llm_with_fallback")
async def test_chat_endpoint_error_handling(mock_call_llm):
    # Simulate LLM crash
    mock_call_llm.side_effect = Exception("API Timeout")
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/chat",
            json={"message": "Hello AI", "model": "auto", "history": []}
        )
    
    # Still returns 200 but success is False (as handled in the chat endpoint catch block)
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "error" in response.json()["reply"].lower()
