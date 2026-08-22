import os
import asyncio
from contextlib import AsyncExitStack
from mcp import ClientSession
from mcp.client.sse import sse_client
from dotenv import load_dotenv

load_dotenv()

async def generate_ui_via_stitch_mcp(structured_product_data: str) -> str:
    """
    Connects to the Google Stitch MCP server via Server-Sent Events (SSE)
    and calls its UI generation tool.
    """
    stitch_api_key = os.environ.get("STITCH_API_KEY", "")
    if not stitch_api_key:
        raise ValueError("STITCH_API_KEY not set")

    # The MCP endpoint for Google Stitch
    url = "https://stitch.withgoogle.com/api/mcp/sse"
    
    headers = {
        "Authorization": f"Bearer {stitch_api_key}",
        "X-Goog-Api-Key": stitch_api_key
    }

    async with AsyncExitStack() as stack:
        try:
            # 1. Establish the SSE transport connection to the MCP Server
            print("Connecting to Google Stitch MCP Server...")
            read_stream, write_stream = await stack.enter_async_context(
                sse_client(url, headers=headers)
            )

            # 2. Start the MCP Client Session
            session = await stack.enter_async_context(
                ClientSession(read_stream, write_stream)
            )
            
            # Initialize the session protocol
            await session.initialize()
            print("MCP Session Initialized!")

            # 3. List available tools on the Stitch server
            # Usually, Stitch exposes a tool like "generate_ui" or "design_component"
            tools = await session.list_tools()
            tool_name = "generate_ui" # Placeholder for actual Stitch tool name
            
            # Check if the tool exists, otherwise pick the first one as a fallback
            available_tool_names = [t.name for t in tools.tools]
            if tool_name not in available_tool_names and available_tool_names:
                tool_name = available_tool_names[0]

            print(f"Calling Stitch MCP Tool: {tool_name}...")

            # 4. Call the MCP tool with our structured data
            result = await session.call_tool(
                tool_name,
                arguments={
                    "prompt": "Create an interactive Tailwind CSS HTML component snippet for an ecommerce product. Return ONLY the HTML snippet (e.g. wrapped in a <div>). Do NOT output full <html>, <head>, or <body> tags, and do NOT wrap in markdown blocks.",
                    "context_data": structured_product_data,
                    "export_format": "html_tailwind"
                }
            )

            # 5. Extract the generated code from the result
            if result.content and len(result.content) > 0:
                # The MCP result content is usually a list of text blocks
                ui_code = result.content[0].text
                return ui_code
            else:
                return "<!-- Stitch returned empty response -->"

        except Exception as e:
            print(f"MCP Bridge Error: {str(e)}")
            return None

# For testing independently
if __name__ == "__main__":
    test_data = '{"specs": {"material": "cotton"}, "features": ["Soft"]}'
    ui = asyncio.run(generate_ui_via_stitch_mcp(test_data))
    print("Result:", ui)
