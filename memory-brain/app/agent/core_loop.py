import json
import logging
from app.agent.memory import AgentMemory
from app.agent.executor import run_terminal_command
from app.core.llm_router import call_llm_with_fallback

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an autonomous AI developer running on a user's local machine.
You have access to a terminal. You can write files, run scripts, install packages, and fix errors.
Always reply strictly in JSON format. Do not add markdown blocks like ```json.
Format:
{
    "thought": "What I need to do next to achieve the user's goal",
    "action": "terminal_command", 
    "command": "python script.py",
    "status": "in_progress" or "completed"
}
If you have achieved the user's ultimate goal, set status to 'completed' and leave command empty.
If you get an error in the previous step, your next thought should be how to fix it, and the next command should be the fix.
"""

async def run_autonomous_loop(user_prompt: str, cwd: str = None, max_iterations: int = 5):
    """
    An async generator that runs the ReAct loop and yields progress dictionaries.
    """
    memory = AgentMemory()
    memory.add_message("user", user_prompt)
    
    iteration = 0
    final_result = ""
    
    plan_tasks = []

    while iteration < max_iterations:
        logger.info(f"--- Iteration {iteration + 1} ---")
        
        current_context = memory.get_context()
        
        # Call LLM
        raw_response = await call_llm_with_fallback(SYSTEM_PROMPT, current_context)
        
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
            ai_decision = json.loads(clean_json)
            memory.add_message("assistant", json.dumps(ai_decision))
            
            thought = ai_decision.get("thought", "Thinking...")
            action = ai_decision.get("action")
            command = ai_decision.get("command", "")
            status = ai_decision.get("status", "in_progress")
            
            # Create a task entry for the UI
            task_id = iteration + 1
            current_task = {
                "id": task_id,
                "title": thought[:60] + "..." if len(thought) > 60 else thought,
                "status": "in_progress"
            }
            plan_tasks.append(current_task)
            
            # Yield plan update to UI
            yield {
                "type": "plan",
                "plan": {
                    "summary": f"Executing iteration {iteration + 1} of max {max_iterations}",
                    "tasks": plan_tasks
                }
            }
            
            # Yield thinking update
            yield {
                "type": "thinking",
                "step": task_id,
                "message": f"🧠 {thought}"
            }
            
            # Check if completed
            if status == "completed":
                final_result = "Task successfully completed by AI!"
                current_task["status"] = "completed"
                break
                
            # Execute Action
            if action == "terminal_command" and command:
                yield {
                    "type": "thinking",
                    "step": task_id,
                    "message": f"💻 Executing: {command}"
                }
                
                exec_result = run_terminal_command(command, cwd=cwd)
                
                if exec_result["success"]:
                    feedback = f"Command successful.\nStdout:\n{exec_result['stdout']}"
                else:
                    feedback = f"Command failed!\nStderr:\n{exec_result['stderr']}\nStdout:\n{exec_result['stdout']}\nFix this error in the next step."
                
                memory.add_message("user", feedback)
                
                # Mark current task as completed since we finished this iteration
                current_task["status"] = "completed"
            else:
                # Agent didn't specify a command but isn't done?
                memory.add_message("user", "System Error: You specified action as terminal_command but provided no command. If you are done, set status to 'completed'.")
                current_task["status"] = "completed"
                
        except json.JSONDecodeError:
            logger.error(f"Error: AI did not return valid JSON. Response was: {clean_json}")
            memory.add_message("user", "System Error: Your previous response was not valid JSON. Please reply strictly in JSON format.")
            
        iteration += 1

    # End of loop
    if iteration >= max_iterations:
        yield {
            "type": "error",
            "message": "Max iterations reached. Agent stopped to prevent infinite loop."
        }
    else:
        yield {
            "type": "done",
            "message": f"✅ {final_result}",
            "plan": {
                "summary": "Agent Execution Finished",
                "tasks": plan_tasks
            }
        }
