import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_health_check():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

def test_fallback_project():
    with TestClient(app) as client:
        response = client.get("/api/v1/memory/project/test-123")
        assert response.status_code == 200
        assert "project_id" in response.json()
        assert response.json()["project_id"] == "test-123"
