from mcp.server.fastmcp import FastMCP

mcp = FastMCP("dummy_fs")

@mcp.tool()
def read_file(path: str) -> str:
    """Read content of a file given its absolute path."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return content[:2000]
    except Exception as e:
        return f"Error reading file: {e}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
