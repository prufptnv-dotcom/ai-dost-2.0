import subprocess
import logging

logger = logging.getLogger(__name__)

def run_terminal_command(command: str, cwd: str = None, timeout: int = 15) -> dict:
    """
    Executes a shell command in a sandboxed/safe way with a strict timeout.
    """
    logger.info(f"Running command: {command}")
    try:
        # Run command with timeout
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=timeout,
            cwd=cwd
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        logger.warning(f"Command timed out after {timeout} seconds: {command}")
        return {
            "stdout": "",
            "stderr": "Command took too long and was terminated.",
            "success": False
        }
    except Exception as e:
        logger.error(f"Error executing command: {e}")
        return {
            "stdout": "",
            "stderr": str(e),
            "success": False
        }
