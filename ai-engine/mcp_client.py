import asyncio
from typing import List, Optional
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession
from langchain_core.tools import StructuredTool
from contextlib import AsyncExitStack
from pydantic import create_model

# P2 FIX (#152): MCP tools were exposed with no argument schema — the
# coroutine was bare **kwargs and tool_info.inputSchema was ignored, so the
# LLM had to guess argument names/types and calls couldn't be validated.
_JSON_TO_PY = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
    "array": list,
    "object": dict,
}


def _args_schema_from_mcp(tool_name: str, schema):
    """Build a pydantic model from an MCP tool inputSchema (best effort)."""
    try:
        props = (schema or {}).get("properties") or {}
        if not props:
            return None
        required = set((schema or {}).get("required") or [])
        fields = {}
        for field_name, spec in props.items():
            spec = spec if isinstance(spec, dict) else {}
            py_type = _JSON_TO_PY.get(spec.get("type", "string"), str)
            if field_name in required:
                fields[field_name] = (py_type, ...)
            else:
                default = spec.get("default")
                if default is None and spec.get("type") == "array":
                    default = []
                elif default is None and spec.get("type") == "object":
                    default = {}
                fields[field_name] = (Optional[py_type], default)
        if not fields:
            return None
        return create_model(f"{tool_name.replace('-', '_')}_Args", **fields)
    except Exception as e:
        print(f"[MCP] could not build args_schema for {tool_name}: {e}", flush=True)
        return None

class MCPClientManager:
    """Manages connection to an MCP server and exposes its tools to LangChain/LangGraph."""
    
    def __init__(self, command: str, args: List[str]):
        self.server_params = StdioServerParameters(command=command, args=args)
        self.session = None
        self._exit_stack = None

    async def connect(self):
        self._exit_stack = AsyncExitStack()
        try:
            read, write = await self._exit_stack.enter_async_context(stdio_client(self.server_params))
            self.session = await self._exit_stack.enter_async_context(ClientSession(read, write))
            await self.session.initialize()
            print(f"[MCP] Connected to server: {self.server_params.command}")
        except Exception as e:
            print(f"[MCP] Connection failed: {e}")
            # P3 #169: cleanup failure must not mask the original connect error
            try:
                await self.close()
            except Exception as cleanup_err:
                print(f"[MCP] close() during failed connect also errored (ignored): {cleanup_err}", flush=True)
            raise e

    async def get_langchain_tools(self) -> List[StructuredTool]:
        """Fetches tools from the MCP server and wraps them for LangChain."""
        if not self.session:
            await self.connect()
            
        try:
            response = await self.session.list_tools()
            tools = []
            
            for tool_info in response.tools:
                # Factory for closure capturing
                def make_coroutine(tool_name):
                    async def acall_tool(**kwargs):
                        try:
                            res = await self.session.call_tool(tool_name, arguments=kwargs)
                            if res.isError:
                                return f"Tool Error: {res.content}"
                            return "\n".join([getattr(c, 'text', str(c)) for c in res.content])
                        except Exception as e:
                            return f"Exception during tool call: {str(e)}"
                    return acall_tool
                
                # Create LangChain StructuredTool (P2 #152: pass a real
                # args_schema built from the MCP inputSchema)
                lc_tool = StructuredTool.from_function(
                    name=tool_info.name,
                    description=tool_info.description,
                    coroutine=make_coroutine(tool_info.name),
                    args_schema=_args_schema_from_mcp(
                        tool_info.name, getattr(tool_info, "inputSchema", None)
                    ),
                )
                tools.append(lc_tool)
            return tools
        except Exception as e:
            # P2 FIX (#153): returning [] here let the agent run with ZERO
            # tools while the caller still got a normal 200 — the failure was
            # invisible. Propagate it so endpoints surface an honest error.
            print(f"[MCP] Error fetching tools: {e}", flush=True)
            raise RuntimeError(
                f"MCP tool listing failed for '{self.server_params.command}': {e}"
            ) from e

    async def close(self):
        if self._exit_stack:
            await self._exit_stack.aclose()
            self._exit_stack = None
            self.session = None
            print("[MCP] Connection closed.")
