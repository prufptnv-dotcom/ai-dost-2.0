# backend/app/api/git_routes.py
from fastapi import APIRouter, Body, HTTPException
import subprocess
import os

router = APIRouter(prefix="/git", tags=["Git"])

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))

def run_git_cmd(cmd_list):
    try:
        res = subprocess.run(
            cmd_list,
            cwd=WORKSPACE_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        if res.returncode == 0:
            return {"success": True, "stdout": res.stdout.strip(), "stderr": res.stderr.strip()}
        else:
            return {"success": False, "error": res.stderr.strip() or res.stdout.strip()}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/init", summary="Initialize local git repo")
async def git_init():
    res = run_git_cmd(["git", "status"])
    if res["success"]:
        return {"success": True, "message": "Git repository is already initialized locally."}
    init_res = run_git_cmd(["git", "init"])
    return init_res

@router.post("/commit", summary="Create local git commit snapshot")
async def git_commit(payload: dict = Body(...)):
    msg = payload.get("message", "Local AI-Dost Snapshot")
    run_git_cmd(["git", "add", "."])
    res = run_git_cmd(["git", "commit", "-m", msg])
    if not res["success"] and "nothing to commit" in res.get("error", ""):
        return {"success": True, "message": "No file changes to commit. Local workspace is clean."}
    return {
        "success": res["success"],
        "message": f"Local Git commit created: '{msg}'" if res["success"] else res.get("error"),
        "details": res.get("stdout", "")
    }

@router.get("/log", summary="Get local commit history log")
async def git_log():
    res = run_git_cmd(["git", "log", "--pretty=format:%h|%an|%ar|%s", "-n", "20"])
    if not res["success"]:
        return {"success": True, "commits": []}
    
    commits = []
    lines = [line for line in res.get("stdout", "").split("\n") if line.strip()]
    for line in lines:
        parts = line.split("|")
        if len(parts) >= 4:
            commits.append({
                "hash": parts[0],
                "author": parts[1],
                "date": parts[2],
                "message": parts[3]
            })
    return {"success": True, "commits": commits}

@router.post("/checkout", summary="Local commit checkout/rollback")
async def git_checkout(payload: dict = Body(...)):
    commit_hash = payload.get("hash", "")
    if not commit_hash:
        raise HTTPException(status_code=400, detail="Commit hash required")
    res = run_git_cmd(["git", "checkout", commit_hash])
    return {
        "success": res["success"],
        "message": f"Restored workspace to local commit [{commit_hash}]" if res["success"] else res.get("error")
    }
