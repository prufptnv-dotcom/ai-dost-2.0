# backend/app/services/sandbox.py
import docker
from docker.errors import DockerException
from typing import List, Dict, Any
from pydantic import BaseModel
from app.database.mongodb import get_database
from fastapi import HTTPException

class CodeExecutionRequest(BaseModel):
    language: str  # "python", "javascript", etc.
    code: str
    dependencies: List[str] = []
    timeout: int = 30000  # 30 seconds default
    memory_limit: str = "512MB"

class ExecutionResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    duration: float

class CodeSandbox:
    def __init__(self, db=None):
        try:
            self.docker_client = docker.from_env()
        except Exception as e:
            # Fallback for systems without active docker daemon during initialization
            self.docker_client = None
            print(f"[WARNING] Docker client initialization warning: {e}")
        self.db = db
        
    async def execute_code(self, request: CodeExecutionRequest) -> ExecutionResult:
        """Secure code execution in isolated container"""
        if not self.docker_client:
            try:
                self.docker_client = docker.from_env()
            except Exception as e:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Docker client is not available on this server host. Please check if Docker Desktop is running. Error: {e}"
                )
            
        container = None
        try:
            # 1. Create container with security constraints
            container = self.docker_client.containers.run(
                image=self._get_language_image(request.language),
                command=self._prepare_command(request),
                mem_limit=request.memory_limit,
                network_mode="none",  # No network access
                detach=True
            )
            
            # 2. Execute and get results (Wait for execution)
            result = container.wait(timeout=request.timeout/1000)
            logs = container.logs().decode("utf-8")
            
            # 3. Extract stdout/stderr
            stdout = logs[:2000]  # Limit output size
            stderr = ""
            if "Traceback" in logs or "Error" in logs:
                stderr = logs[-2000:]
                
            return ExecutionResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=result.get('StatusCode', 0),
                duration=float(request.timeout / 1000.0) # Estimated duration
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Code execution failed: {str(e)}")
        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    pass

    def _get_language_image(self, language: str) -> str:
        """Map language to Docker image"""
        images = {
            "python": "python:3.11-slim",
            "javascript": "node:18-alpine",
            "go": "golang:1.21-alpine",
            "java": "eclipse-temurin:8-jdk-alpine"
        }
        return images.get(language.lower(), "python:3.11-slim")

    def _prepare_command(self, request: CodeExecutionRequest) -> List[str]:
        """Prepare execution command"""
        if request.language.lower() == "python":
            return ["python", "-c", request.code]
        elif request.language.lower() == "javascript":
            return ["node", "-e", request.code]
        return ["python", "-c", request.code]
