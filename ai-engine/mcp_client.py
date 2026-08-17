import asyncio
from typing import List
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession
from langchain_core.tools import StructuredTool
from contextlib import AsyncExitStack

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
            await self.close()
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
                
                # Create LangChain StructuredTool
                lc_tool = StructuredTool.from_function(
                    name=tool_info.name,
                    description=tool_info.description,
                    coroutine=make_coroutine(tool_info.name),
                )
                tools.append(lc_tool)
            return tools
        except Exception as e:
            print(f"[MCP] Error fetching tools: {e}")
            return []

    async def close(self):
        if self._exit_stack:
            await self._exit_stack.aclose()
            self._exit_stack = None
            self.session = None
            print("[MCP] Connection closed.")
