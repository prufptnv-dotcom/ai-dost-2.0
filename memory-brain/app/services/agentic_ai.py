import requests
import numpy as np
from app.services.vector_db import VectorDBService
from app.services.llm_router import LLMRouter
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class AgenticAI:
    def __init__(self):
        self.vector_db = VectorDBService()
        self.llm_router = LLMRouter()
        
    def _get_code_context(self, current_file: str, nearby_lines: int = 5) -> str:
        query = f"file:{current_file} language:Python"
        results = self.vector_db.query_context(query, k=3)
        context = "\n".join([res.get("text", "") for res in results])
        return context[-500:]

    async def monitor_and_autocomplete(self, code_stream: Dict) -> Dict:
        try:
            file_path = code_stream.get("file_path", "main.py")
            cursor_position = code_stream.get("cursor", 0)
            existing_code = code_stream.get("code", "")
            
            context = self._get_code_context(file_path)
            prompt = f"{context}\n\n# Your code so far:\n{existing_code}\n\n# Auto-complete suggestion:\n"
            
            llm = self.llm_router.route("inline_suggestion")
            
            suggestion = " # AI-Dost Ghost Suggestion\n    return True"
            
            if llm.get("api_key") and llm.get("endpoint"):
                try:
                    response = requests.post(
                        llm["endpoint"],
                        headers={"Authorization": f"Bearer {llm['api_key']}"},
                        json={
                            "model": llm["name"],
                            "prompt": prompt,
                            "max_tokens": 150,
                            "temperature": 0.7
                        },
                        timeout=10
                    )
                    if response.status_code == 200:
                        suggestion = response.json().get("completion", suggestion)
                except Exception as ex:
                    logger.warning(f"Remote completion request failed: {ex}")

            return {
                "file_path": file_path,
                "suggestion": suggestion,
                "confidence": self._calculate_confidence(suggestion),
                "context_matches": self.vector_db.query_context(prompt, k=2)
            }
        except Exception as e:
            return {"error": str(e)}

    def _calculate_confidence(self, suggestion: str) -> float:
        tokens = suggestion.split()
        if not tokens:
            return 0.5
        unique_ratio = len(set(tokens)) / len(tokens)
        return round(unique_ratio * 0.8 + 0.2, 2)
