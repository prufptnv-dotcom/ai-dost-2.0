import json
import logging
from app.core.llm_router import call_llm_with_fallback

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """
You are an autonomous AI engineering agent. Break down the user's prompt into logical steps.
You MUST output ONLY valid JSON in the exact following format, without any markdown formatting or extra text:

{
  "plan": {
    "summary": "Short description of what we are doing",
    "tasks": [
      {
        "id": 1,
        "title": "Short title of step 1",
        "status": "pending"
      },
      {
        "id": 2,
        "title": "Short title of step 2",
        "status": "pending"
      }
    ]
  }
}
"""

async def generate_plan(prompt: str) -> dict:
    """
    Calls the LLM to generate a JSON execution plan for the given prompt.
    """
    logger.info("Generating task plan...")
    raw_response = await call_llm_with_fallback(PLANNER_SYSTEM_PROMPT, prompt)
    
    # Clean up response if the LLM added markdown formatting
    clean_json = raw_response.strip()
    if clean_json.startswith("```json"):
        clean_json = clean_json[7:]
    if clean_json.startswith("```"):
        clean_json = clean_json[3:]
    if clean_json.endswith("```"):
        clean_json = clean_json[:-3]
    clean_json = clean_json.strip()

    try:
        parsed_data = json.loads(clean_json)
        # Ensure status of first task is in_progress
        if "plan" in parsed_data and "tasks" in parsed_data["plan"] and len(parsed_data["plan"]["tasks"]) > 0:
            parsed_data["plan"]["tasks"][0]["status"] = "in_progress"
        return parsed_data["plan"]
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse planner JSON: {clean_json}")
        # Fallback to a default generic plan if the LLM completely fails at JSON
        return {
            "summary": f"Executing task: {prompt}",
            "tasks": [
                {"id": 1, "title": "Analyze and setup", "status": "in_progress"},
                {"id": 2, "title": "Execute requested actions", "status": "pending"},
                {"id": 3, "title": "Verify and complete", "status": "pending"}
            ]
        }
