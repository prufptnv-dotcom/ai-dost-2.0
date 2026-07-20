# backend/app/api/sandbox_routes.py
from fastapi import APIRouter, Depends, HTTPException
from app.services.sandbox import CodeExecutionRequest, ExecutionResult, CodeSandbox
from app.auth.auth import get_current_active_user
from app.models.user import UserResponse
from app.database.mongodb import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/sandbox", tags=["Code Execution"])

@router.post("/execute", response_model=ExecutionResult, summary="Secure code execution")
async def execute_code(
    request: CodeExecutionRequest,
    current_user: UserResponse = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Execute code safely in isolated container"""
    try:
        sandbox = CodeSandbox(db)
        return await sandbox.execute_code(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
