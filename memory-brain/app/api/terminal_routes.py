import asyncio
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import platform
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/terminal", tags=["Terminal"])

@router.websocket("/ws")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    
    # Identify platform
    is_windows = platform.system().lower() == "windows"
    
    try:
        if is_windows:
            process = await asyncio.create_subprocess_exec(
                "cmd.exe",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=os.getcwd(),
            )
        else:
            process = await asyncio.create_subprocess_exec(
                "/bin/bash",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=os.getcwd(),
            )
    except Exception as e:
        logger.error(f"Failed to spawn terminal process: {e}")
        await websocket.send_text(f"Error starting terminal: {e}\n")
        await websocket.close()
        return

    async def read_output():
        try:
            while True:
                # Read 1024 bytes at a time
                data = await process.stdout.read(1024)
                if not data:
                    break
                await websocket.send_text(data.decode('utf-8', errors='replace'))
        except Exception as e:
            logger.error(f"Error reading stdout: {e}")

    async def read_input():
        try:
            while True:
                data = await websocket.receive_text()
                # Windows cmd expects \r\n
                if is_windows and not data.endswith('\r\n'):
                    if data.endswith('\n'):
                        data = data[:-1] + '\r\n'
                    else:
                        data += '\r\n'
                elif not is_windows and not data.endswith('\n'):
                    data += '\n'
                
                process.stdin.write(data.encode('utf-8'))
                await process.stdin.drain()
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Error reading websocket: {e}")

    # Run both loops
    read_task = asyncio.create_task(read_output())
    write_task = asyncio.create_task(read_input())
    
    done, pending = await asyncio.wait(
        [read_task, write_task],
        return_when=asyncio.FIRST_COMPLETED,
    )
    
    for task in pending:
        task.cancel()
        
    try:
        process.terminate()
    except Exception:
        pass
    
    try:
        await websocket.close()
    except Exception:
        pass
