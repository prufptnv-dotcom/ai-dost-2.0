from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid
from app.auth.auth import get_current_active_user
from app.models.user import UserResponse
from app.database.mongodb import MongoDB

router = APIRouter(prefix="/todos", tags=["todos"])

class TodoItemCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None

class TodoItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None

class TodoItemResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    completed: bool
    created_at: datetime
    updated_at: datetime

@router.get("", response_model=List[TodoItemResponse])
async def get_todos(current_user: UserResponse = Depends(get_current_active_user)):
    db = MongoDB.get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    cursor = db.todos.find({"user_id": current_user.user_id}).sort("created_at", -1)
    todos = await cursor.to_list(length=100)
    
    # Map _id or just use id
    for todo in todos:
        todo["id"] = todo.get("id", str(todo.get("_id", "")))
        
    return todos

@router.post("", response_model=TodoItemResponse)
async def create_todo(
    todo: TodoItemCreate, 
    current_user: UserResponse = Depends(get_current_active_user)
):
    db = MongoDB.get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    now = datetime.utcnow()
    new_todo = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "title": todo.title,
        "description": todo.description,
        "completed": False,
        "created_at": now,
        "updated_at": now
    }
    
    await db.todos.insert_one(new_todo)
    return new_todo

@router.put("/{todo_id}", response_model=TodoItemResponse)
async def update_todo(
    todo_id: str,
    todo_update: TodoItemUpdate,
    current_user: UserResponse = Depends(get_current_active_user)
):
    db = MongoDB.get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    existing = await db.todos.find_one({"id": todo_id, "user_id": current_user.user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Todo not found")
        
    update_data = {}
    if todo_update.title is not None:
        update_data["title"] = todo_update.title
    if todo_update.description is not None:
        update_data["description"] = todo_update.description
    if todo_update.completed is not None:
        update_data["completed"] = todo_update.completed
        
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.todos.update_one(
            {"id": todo_id, "user_id": current_user.user_id},
            {"$set": update_data}
        )
        
    updated = await db.todos.find_one({"id": todo_id, "user_id": current_user.user_id})
    updated["id"] = updated.get("id", str(updated.get("_id", "")))
    return updated

@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: str,
    current_user: UserResponse = Depends(get_current_active_user)
):
    db = MongoDB.get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    result = await db.todos.delete_one({"id": todo_id, "user_id": current_user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
        
    return {"success": True, "message": "Todo deleted successfully"}
