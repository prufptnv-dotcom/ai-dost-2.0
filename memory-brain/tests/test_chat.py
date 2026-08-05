import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch

@patch("app.api.chat.call_llm_with_fallback")
def test_chat_endpoint(mock_call_llm):
    mock_call_llm.return_value = "Mocked LLM Response"
    
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat",
            json={"message": "Hello AI", "model": "auto", "history": []}
        )
        
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["reply"] == "Mocked LLM Response"

@patch("app.api.chat.call_llm_with_fallback")
def test_chat_endpoint_error_handling(mock_call_llm):
    # Simulate LLM crash
    mock_call_llm.side_effect = Exception("API Timeout")
    
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat",
            json={"message": "Hello AI", "model": "auto", "history": []}
        )
    
    # Still returns 200 but success is False (as handled in the chat endpoint catch block)
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "error" in response.json()["reply"].lower()
