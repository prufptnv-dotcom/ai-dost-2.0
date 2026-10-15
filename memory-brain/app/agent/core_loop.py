import json
import logging
from app.agent.memory import AgentMemory
from app.agent.executor import run_terminal_command
from app.core.llm_router import call_llm_with_fallback

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an autonomous AI developer running on a user's local machine.
You have access to tools to write files and run terminal scripts.
CRITICAL: The user's operating system is WINDOWS. You MUST use Windows `cmd` commands for terminal execution. 
For example: use `type` instead of `cat`, `dir` instead of `ls`, `del` instead of `rm`, etc.
Always reply strictly in JSON format. Do not add markdown blocks like ```json.
Format:
{
    "thought": "What I need to do next to achieve the user's goal",
    "action": "run_terminal" or "write_file" or "done", 
    "command": "python script.py", # Only if action is run_terminal
    "file_path": "main.py", # Only if action is write_file
    "file_content": "print('hello')", # Only if action is write_file
    "status": "in_progress" or "completed"
}
If you have achieved the user's ultimate goal, set action to 'done' and status to 'completed'.
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
            file_path = ai_decision.get("file_path", "")
            file_content = ai_decision.get("file_content", "")
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
            if action == "done" or status == "completed":
                final_result = "Task successfully completed by AI!"
                current_task["status"] = "completed"
                break
                
            # Execute Action
            if action == "run_terminal" and command:
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
                
                yield {
                    "type": "step",
                    "stepLog": {
                        "step": task_id,
                        "action": "run_terminal",
                        "thought": thought,
                        "parameters": {"command": command},
                        "result": {
                            "success": exec_result["success"],
                            "stdout": exec_result["stdout"],
                            "stderr": exec_result["stderr"],
                            "exit_code": 0 if exec_result["success"] else 1
                        }
                    }
                }
                current_task["status"] = "completed"
                
            elif action == "write_file" and file_path:
                import os
                
                yield {
                    "type": "thinking",
                    "step": task_id,
                    "message": f"📝 Writing file: {file_path}"
                }
                
                full_path = os.path.join(cwd if cwd else ".", file_path)
                try:
                    os.makedirs(os.path.dirname(full_path), exist_ok=True)
                    with open(full_path, "w", encoding="utf-8") as f:
                        f.write(file_content)
                    
                    feedback = f"Successfully wrote to {file_path}"
                    memory.add_message("user", feedback)
                    
                    yield {
                        "type": "step",
                        "stepLog": {
                            "step": task_id,
                            "action": "write_file",
                            "thought": thought,
                            "parameters": {"path": file_path},
                            "result": {
                                "success": True,
                                "changedFile": file_path,
                                "newContent": file_content
                            }
                        }
                    }
                except Exception as e:
                    error_msg = f"Failed to write file {file_path}: {str(e)}"
                    memory.add_message("user", error_msg)
                    yield {
                        "type": "step",
                        "stepLog": {
                            "step": task_id,
                            "action": "write_file",
                            "thought": thought,
                            "parameters": {"path": file_path},
                            "result": {
                                "success": False,
                                "error": error_msg
                            }
                        }
                    }
                current_task["status"] = "completed"
            else:
                # Agent didn't specify a valid action
                memory.add_message("user", "System Error: You specified an invalid action or missing parameters. Use 'run_terminal' or 'write_file' or 'done'.")
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
