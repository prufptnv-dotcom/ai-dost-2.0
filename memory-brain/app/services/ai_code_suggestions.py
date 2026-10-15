import os
import httpx
from pydantic import BaseModel
from typing import List, Dict, Any
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorDatabase

class CodeSuggestionRequest(BaseModel):
    code_context: str
    language: str
    project_id: str

class CodeSuggestionResponse(BaseModel):
    suggestions: List[Dict[str, str]]
    confidence: float
    explanation: str

class AICodeSuggestionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        # Load API keys from sibling env if needed
        sibling_env = dotenv_values("../backend/.env")
        self.hf_key = os.getenv("HUGGINGFACE_API_KEY") or sibling_env.get("HUGGINGFACE_API_KEY")

    async def get_suggestions(self, request: CodeSuggestionRequest) -> CodeSuggestionResponse:
        if not self.hf_key:
            return CodeSuggestionResponse(
                suggestions=[{"code": "# Error: HUGGINGFACE_API_KEY not configured", "explanation": "Please set HUGGINGFACE_API_KEY in .env"}],
                confidence=0.0,
                explanation="Hugging Face API key is missing."
            )

        try:
            # 1. Retrieve project context from MongoDB
            project = None
            if request.project_id and request.project_id != "current-project-id" and request.project_id != "demo_user_id":
                project = await self.db.projects.find_one({"project_id": request.project_id})
                
            project_desc = project.get("description", "A project in development.") if project else "General project context."
            project_name = project.get("project_name", "Untitled") if project else "General"
            tech_stack_list = project.get("tech_stack", []) if project else []
            tech_stack = ", ".join([t.get("name") if isinstance(t, dict) else str(t) for t in tech_stack_list])

            # 2. Build code completion prompt
            prompt = f"""// Language: {request.language}
// Project: {project_name} - {project_desc}
// Tech: {tech_stack}

{request.code_context}"""

            # 3. Call Hugging Face Serverless Inference API (using Qwen/Qwen2.5-Coder-1.5B-Instruct which is extremely fast and free)
            model_id = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
            url = f"https://api-inference.huggingface.co/models/{model_id}"
            headers = {"Authorization": f"Bearer {self.hf_key}"}
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 50,
                    "temperature": 0.2,
                    "return_full_text": False
                }
            }

            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=10.0)
                res.raise_for_status()
                res_data = res.json()

            # 4. Extract generated text
            generated_text = ""
            if isinstance(res_data, list) and len(res_data) > 0:
                generated_text = res_data[0].get("generated_text", "")
            elif isinstance(res_data, dict):
                generated_text = res_data.get("generated_text", "")

            # Truncate if generation spills into unwanted text
            completion = generated_text.split("//")[0].split("class ")[0].strip()

            suggestions = []
            if completion:
                suggestions.append({
                    "code": completion,
                    "explanation": f"Hugging Face ({model_id}) free serverless code completion suggestion."
                })
            else:
                suggestions.append({
                    "code": "# Keep typing...",
                    "explanation": "Hugging Face did not return a meaningful completion for the current context."
                })

            return CodeSuggestionResponse(
                suggestions=suggestions,
                confidence=0.75,
                explanation="Suggestions generated successfully using Hugging Face free Inference API."
            )

        except Exception as e:
            return CodeSuggestionResponse(
                suggestions=[{"code": "# Error generating suggestions", "explanation": str(e)}],
                confidence=0.0,
                explanation=f"Error occurred: {str(e)}"
            )
