import os
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
os.environ["DATABASE_NAME"] = "ai_dost_test"

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.mongodb import get_database

@pytest.fixture(scope="function")
def client():
    # Start app (lifespan startup will connect to MONGODB_URL in the correct event loop)
    # Clear database before test run using a synchronous client to avoid loop mismatches
    from pymongo import MongoClient
    sync_client = MongoClient("mongodb://localhost:27017")
    sync_client.drop_database("ai_dost_test")
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Teardown database synchronously
    sync_client.drop_database("ai_dost_test")
    sync_client.close()

def test_create_user(client):
    response = client.post("/api/v1/profile/", json={
        "name": "Test User",
        "password": "testpassword123",
        "skill_level": "intermediate",
        "github_username": "test_user"
    })
    assert response.status_code == 200
    assert response.json()["github_username"] == "test_user"

def test_create_project(client):
    # First register user to ensure they exist
    reg_response = client.post("/api/v1/profile/", json={
        "name": "Test User",
        "password": "testpassword123",
        "skill_level": "intermediate",
        "github_username": "test_user"
    })
    assert reg_response.status_code == 200

    # Authenticate user
    login = client.post("/api/v1/auth/login", json={
        "username": "test_user",
        "password": "testpassword123"
    })
    assert login.status_code == 200
    
    token = login.json()["access_token"]
    user_id = login.json()["user_id"]
    
    # Create project
    response = client.post(f"/api/v1/memory/project?user_id={user_id}", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "project_name": "Test Project",
        "description": "Test description which is long enough to pass validation schema.",
        "tech_stack": []
    })
    assert response.status_code == 200
    assert "project_id" in response.json()

def test_ai_suggestions(client):
    # Register user
    reg_response = client.post("/api/v1/profile/", json={
        "name": "Test User",
        "password": "testpassword123",
        "skill_level": "intermediate",
        "github_username": "test_user"
    })
    assert reg_response.status_code == 200

    # Authenticate user
    login = client.post("/api/v1/auth/login", json={
        "username": "test_user",
        "password": "testpassword123"
    })
    assert login.status_code == 200
    token = login.json()["access_token"]

    # Request suggestions
    response = client.post("/api/v1/ai/code-suggestions", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "code_context": "def hello():\n",
        "language": "python",
        "project_id": "current-project-id"
    })
    assert response.status_code == 200
    assert "suggestions" in response.json()

def test_project_file_actions(client):
    # Register user
    reg_response = client.post("/api/v1/profile/", json={
        "name": "Test User",
        "password": "testpassword123",
        "skill_level": "intermediate",
        "github_username": "test_user2"
    })
    assert reg_response.status_code == 200

    # Authenticate user
    login = client.post("/api/v1/auth/login", json={
        "username": "test_user2",
        "password": "testpassword123"
    })
    assert login.status_code == 200
    token = login.json()["access_token"]
    user_id = login.json()["user_id"]

    # Create project
    create_res = client.post(f"/api/v1/memory/project?user_id={user_id}", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "project_name": "Test Project Files",
        "description": "Test description which is long enough to pass validation schema.",
        "tech_stack": []
    })
    assert create_res.status_code == 200
    project_id = create_res.json()["project_id"]

    # Add project file
    add_res = client.post(f"/api/v1/memory/project/{project_id}/file", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "file_path": "test_file.py",
        "content": "print('hello')"
    })
    assert add_res.status_code == 200
    assert add_res.json()["success"] is True

    # Save project file (update content)
    save_res = client.put(f"/api/v1/memory/project/{project_id}/file", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "file_path": "test_file.py",
        "content": "print('hello world')"
    })
    assert save_res.status_code == 200
    assert save_res.json()["success"] is True

    # Query version history list
    version_res = client.get(f"/api/v1/memory/project/{project_id}/file/versions?file_path=test_file.py", headers={
        "Authorization": f"Bearer {token}"
    })
    assert version_res.status_code == 200
    versions = version_res.json()
    assert len(versions) > 0
    assert any(v["content"] == "print('hello world')" for v in versions)

    # Get project details to verify file content was saved
    get_res = client.get(f"/api/v1/memory/project/{project_id}", headers={
        "Authorization": f"Bearer {token}"
    })
    assert get_res.status_code == 200
    files = get_res.json().get("files", [])
    assert any(f["path"] == "test_file.py" and f["content"] == "print('hello world')" for f in files)

    # Delete project file
    del_res = client.delete(f"/api/v1/memory/project/{project_id}/file?file_path=test_file.py", headers={
        "Authorization": f"Bearer {token}"
    })
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
