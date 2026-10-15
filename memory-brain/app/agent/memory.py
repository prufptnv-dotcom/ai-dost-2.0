from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class AgentMemory:
    """
    Maintains the short-term context history of the agent's actions during a session.
    """
    def __init__(self):
        self.history: List[Dict[str, str]] = []
        self.max_history = 30  # Increased to allow for a decent ReAct loop

    def add_message(self, role: str, content: str):
        """Role can be 'user', 'assistant', or 'system'"""
        self.history.append({"role": role, "content": content})
        self._trim_history()

    def get_context(self) -> str:
        """Pichli baaton ka context LLM ko bhejne ke liye format karta hai"""
        if not self.history:
            return "No previous actions taken in this session."
            
        context = "Previous Actions and Observations:\n"
        for msg in self.history:
            # We enforce a maximum length per message to prevent context overflow from huge terminal logs
            content = msg['content']
            if len(content) > 2000:
                content = content[:1000] + "\n...[TRUNCATED]...\n" + content[-1000:]
                
            context += f"<{msg['role'].upper()}>\n{content}\n</{msg['role'].upper()}>\n\n"
        return context

    def clear(self):
        self.history = []

    def _trim_history(self):
        """Trims history to the maximum allowed size while keeping the first instruction."""
        if len(self.history) > self.max_history:
            # Keep the original user prompt (index 0) and the most recent ones
            self.history = [self.history[0]] + self.history[-(self.max_history - 1):]
