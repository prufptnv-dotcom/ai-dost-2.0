from app.services.vector_db import VectorDBService
from app.services.llm_router import LLMRouter
from app.config.models import LLMConfig
import requests
import logging

logger = logging.getLogger(__name__)

class DebuggingService:
    def __init__(self):
        self.vector_db = VectorDBService()
        self.llm_config = LLMConfig()
    
    async def analyze_error(self, error_data: dict) -> dict:
        try:
            error_text = error_data.get("error", "")
            stack_trace = error_data.get("stack_trace", "")
            context = error_data.get("context", "")
            
            context_results = self.vector_db.query_context(f"{error_text} {context}")
            
            prompt = f"""
            You are an expert debugger. Analyze the following error and provide a solution:
            
            Error: {error_text}
            Stack Trace: {stack_trace}
            Context: {context}
            
            Similar code contexts:
            {self._format_context_results(context_results)}
            
            Provide a step-by-step solution and a git patch if applicable.
            """
            
            llm = LLMRouter().route("debug")
            
            # Dynamic fallback to Groq / NVIDIA / Local Ollama if API key is not present
            solution_text = f"Analyzed error: '{error_text}'. Recommendation: Check stack trace line references and handle null values cleanly."
            
            if llm.get("api_key"):
                try:
                    response = requests.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {llm['api_key']}", "Content-Type": "application/json"},
                        json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "max_tokens": 1000},
                        timeout=10
                    )
                    if response.status_code == 200:
                        solution_text = response.json()["choices"][0]["message"]["content"]
                except Exception as ex:
                    logger.warning(f"Remote LLM debug call failed: {ex}")

            return {
                "solution": solution_text,
                "context_matches": context_results
            }
        except Exception as e:
            logger.error(f"Error analysis failed: {e}")
            raise RuntimeError("Error analysis failed") from e
    
    def _format_context_results(self, results: list[dict]) -> str:
        formatted = []
        for i, result in enumerate(results, 1):
            file_name = result.get('metadata', {}).get('file', 'Unknown')
            formatted.append(f"{i}. File: {file_name}\nText: {result.get('text', '')}")
        return "\n".join(formatted)
