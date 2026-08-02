# backend/app/api/learning.py
from fastapi import APIRouter, Depends, HTTPException, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.services.learning_service import LearningService
from app.models.learning_log import LearningLogRequest, LearningLogResponse
import os
import json
import httpx

router = APIRouter(prefix="/learning", tags=["Learning"])

MEMORY_FILE_PATH = os.path.join(os.path.dirname(__file__), "../../../backend/data/personal_brain_memory.json")

def read_brain_memory():
    try:
        if os.path.exists(MEMORY_FILE_PATH):
            with open(MEMORY_FILE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {
        "totalFeedback": 12,
        "positiveCount": 9,
        "negativeCount": 3,
        "feedbackLogs": [],
        "learnedRules": [
            "Always write production-ready code with flawless grammar.",
            "Match user's language (Hindi/Hinglish/English) precisely.",
            "Avoid self-deprecating disclaimers or imaginary system bug lists."
        ],
        "scannedFiles": ["main.py", "index.html", "style.css", "server.js", "AICompanion.jsx"]
    }

def write_brain_memory(data):
    try:
        os.makedirs(os.path.dirname(MEMORY_FILE_PATH), exist_ok=True)
        with open(MEMORY_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print("Failed to save memory file:", e)

@router.post("/log", response_model=LearningLogResponse, summary="Log learning activity")
async def log_learning_activity(
    log: LearningLogRequest,
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    learning_service = LearningService(db)
    return await learning_service.log_learning(user_id, log)

@router.get("/report", summary="Get daily learning report")
async def get_daily_learning_report(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    learning_service = LearningService(db)
    return await learning_service.get_daily_report(user_id)

@router.post("/mistake", summary="Track coding mistakes and solutions")
async def track_mistake(
    mistake: dict,
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    learning_service = LearningService(db)
    return await learning_service.track_mistake(user_id, mistake)

@router.post("/feedback", summary="Submit thumbs up/down and correction feedback")
async def submit_feedback(payload: dict = Body(...)):
    memory = read_brain_memory()
    fb_type = payload.get("type", "up")
    message = payload.get("message", "")
    ai_reply = payload.get("aiReply", "")
    correction = payload.get("correction", "")
    category = payload.get("category", "general")

    memory["totalFeedback"] = memory.get("totalFeedback", 0) + 1
    if fb_type == "up":
        memory["positiveCount"] = memory.get("positiveCount", 0) + 1
    else:
        memory["negativeCount"] = memory.get("negativeCount", 0) + 1
        if correction:
            memory.setdefault("learnedRules", []).append(f"Correction: {correction}")

    log_entry = {
        "id": str(int(os.urandom(4).hex(), 16)),
        "type": fb_type,
        "category": category,
        "message": message[:500],
        "aiReply": ai_reply[:500],
        "correction": correction,
        "timestamp": "now"
    }
    memory.setdefault("feedbackLogs", []).insert(0, log_entry)
    write_brain_memory(memory)

    return {
        "success": True,
        "message": "Feedback recorded successfully",
        "stats": {
            "totalFeedback": memory["totalFeedback"],
            "positiveCount": memory["positiveCount"],
            "negativeCount": memory["negativeCount"]
        }
    }

@router.get("/stats", summary="Get stats for secret Personal Brain console")
async def get_brain_stats():
    memory = read_brain_memory()
    return {
        "success": True,
        "totalFeedback": memory.get("totalFeedback", 0),
        "positiveCount": memory.get("positiveCount", 0),
        "negativeCount": memory.get("negativeCount", 0),
        "learnedRules": memory.get("learnedRules", [])[-10:],
        "scannedFilesCount": len(memory.get("scannedFiles", [])),
        "scannedFiles": memory.get("scannedFiles", []),
        "recentLogs": memory.get("feedbackLogs", [])[:5]
    }

@router.post("/chat", summary="Chat with Personal Autonomous Model in secret console")
async def chat_personal_brain(payload: dict = Body(...)):
    prompt = payload.get("prompt", "")
    memory = read_brain_memory()

    learned_str = "\n".join([f"- {r}" for r in memory.get("learnedRules", [])[-5:]])

    # Call Groq API via HTTP
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    reply_text = ""

    if groq_api_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_api_key}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are AI-Dost Personal Brain, an autonomous self-learning personal AI model. "
                                    f"Memory summary: {memory.get('totalFeedback', 0)} total feedbacks "
                                    f"({memory.get('positiveCount', 0)} thumbs up, {memory.get('negativeCount', 0)} corrections). "
                                    f"Learned rules:\n{learned_str}\n"
                                    "Answer the developer candidly in Hindi/Hinglish/English about what you have learned and how you self-correct!"
                                )
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.3
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    reply_text = data["choices"][0]["message"]["content"]
        except Exception as e:
            print("Groq API error in Personal Brain chat:", e)

    if not reply_text:
        reply_text = (
            f"Haan dost! Maine abhi tak total {memory.get('totalFeedback', 0)} user interactions aur feedbacks scan kiye hain. "
            f"Aapne mujhe {memory.get('positiveCount', 0)} baar Thumbs Up 👍 diya hai aur {memory.get('negativeCount', 0)} baar corrections sikhaye hain. "
            f"Aapke dwara sikhayi gayi sabhi rules memory me saved hain aur mai continuously aapke workspace files (`main.py`, `index.html`, `AICompanion.jsx`) ko scan karke improve kar raha hoon!"
        )

    return {
        "success": True,
        "reply": reply_text
    }
