from app.config.models import LLMConfig
import logging

logger = logging.getLogger(__name__)

class LLMRouter:
    def __init__(self):
        self.config = LLMConfig()
    
    def route(self, request_type: str) -> dict:
        try:
            if request_type in ["inline_suggestion", "single_line"]:
                return self.config.fast
            elif request_type in ["chat", "explanation", "debug"]:
                return self.config.heavy
            else:
                logger.warning(f"Unknown request type: {request_type}, defaulting to heavy model")
                return self.config.heavy
        except Exception as e:
            logger.error(f"LLM routing failed: {e}")
            raise RuntimeError("LLM routing error") from e
