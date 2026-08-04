import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_fallback_project():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/memory/project/test-123")
    assert response.status_code == 200
    assert "project_id" in response.json()
    assert response.json()["project_id"] == "test-123"
