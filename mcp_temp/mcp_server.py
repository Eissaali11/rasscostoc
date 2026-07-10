import os
import sys
import json
import subprocess
import psycopg2
from psycopg2.extras import RealDictCursor
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL", "")
API_KEY = os.environ.get("API_KEY", "Nulip2026R8mQwX9")

# FastMCP Initialization
mcp = FastMCP("StockPro-Inventory-Manager")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

@mcp.tool()
def get_inventory_summary() -> str:
    """الحصول على ملخص إحصائي للمخزون والأقاليم والمستخدمين والمستودعات والتحويلات."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Users
        cur.execute("SELECT COUNT(*) as count FROM users")
        total_users = cur.fetchone()['count']
        cur.execute("SELECT COUNT(*) as count FROM users WHERE \"isActive\" = true")
        active_users = cur.fetchone()['count']
        
        # Regions
        cur.execute("SELECT COUNT(*) as count FROM regions")
        total_regions = cur.fetchone()['count']
        
        # Warehouses
        cur.execute("SELECT COUNT(*) as count FROM warehouses")
        total_warehouses = cur.fetchone()['count']
        
        # Devices/Serialized Items
        cur.execute("SELECT COUNT(*) as count FROM serialized_items")
        total_devices = cur.fetchone()['count']
        
        cur.close()
        conn.close()
        
        return json.dumps({
            "total_users": total_users,
            "active_users": active_users,
            "total_regions": total_regions,
            "total_warehouses": total_warehouses,
            "total_devices": total_devices
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"خطأ أثناء جلب ملخص المخزون: {str(e)}"

@mcp.tool()
def list_users() -> str:
    """عرض قائمة بجميع المستخدمين المسجلين في نظام ستوك برو وحالتهم الحالية ودورهم الوظيفي."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, username, \"fullName\", email, role, \"isActive\", city FROM users ORDER BY \"fullName\" ASC")
        users = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(users, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"خطأ أثناء جلب قائمة المستخدمين: {str(e)}"

@mcp.tool()
def list_warehouses() -> str:
    """عرض قائمة بجميع المستودعات ومواقعها ورموزها."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, location, code FROM warehouses ORDER BY name ASC")
        warehouses = cur.fetchall()
        cur.close()
        conn.close()
        return json.dumps(warehouses, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"خطأ أثناء جلب قائمة المستودعات: {str(e)}"

@mcp.tool()
def run_custom_query(sql_query: str) -> str:
    """تشغيل استعلام SQL مخصص على قاعدة بيانات StockPro للحصول على أي بيانات تفصيلية أو إجراء تسوية."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(sql_query)
        
        if cur.description:
            rows = cur.fetchall()
            cur.close()
            conn.close()
            return json.dumps(rows, ensure_ascii=False, indent=2, default=str)
        else:
            conn.commit()
            rowcount = cur.rowcount
            cur.close()
            conn.close()
            return json.dumps({"status": "success", "rows_affected": rowcount})
    except Exception as e:
        return f"خطأ أثناء تنفيذ الاستعلام: {str(e)}"

# Custom SSE Server via Starlette supporting Claude.ai Custom Connectors
def make_custom_sse_app():
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.responses import JSONResponse, Response, RedirectResponse
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware
    from mcp.server.sse import SseServerTransport

    sse_transport = SseServerTransport("/message")

    def check_auth(request):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            return token == API_KEY
        
        query_token = request.query_params.get("api_key")
        if query_token == API_KEY:
            return True
            
        return False

    class SSResponse(Response):
        def __init__(self, sse_transport, mcp_server):
            super().__init__()
            self.sse_transport = sse_transport
            self.mcp_server = mcp_server

        async def __call__(self, scope, receive, send):
            async with self.sse_transport.connect_sse(
                scope, receive, send
            ) as (read_stream, write_stream):
                await self.mcp_server.run(
                    read_stream,
                    write_stream,
                    self.mcp_server.create_initialization_options()
                )

    async def handle_sse(request):
        if request.method == "OPTIONS":
            return Response(status_code=200)
        if request.method != "GET":
            return Response(status_code=405)
            
        if not check_auth(request):
            return JSONResponse({"success": False, "message": "Unauthorized. Invalid API Key."}, status_code=401)
        
        return SSResponse(sse_transport, mcp._mcp_server)

    async def handle_message(request):
        if request.method == "OPTIONS":
            return Response(status_code=200)
        if request.method != "POST":
            return Response(status_code=405)
            
        if not check_auth(request):
            return JSONResponse({"success": False, "message": "Unauthorized."}, status_code=401)
        
        return sse_transport.handle_post_message

    async def oauth_protected_resource(request):
        return JSONResponse({
            "resource": "https://nuzum.fun/sse",
            "authorization_servers": [
                "https://nuzum.fun"
            ],
            "bearer_methods_supported": ["header"]
        })

    async def oauth_authorization_server(request):
        return JSONResponse({
            "issuer": "https://nuzum.fun",
            "authorization_endpoint": "https://nuzum.fun/oauth/authorize",
            "token_endpoint": "https://nuzum.fun/oauth/token",
            "registration_endpoint": "https://nuzum.fun/oauth/register",
            "response_types_supported": ["code"],
            "code_challenge_methods_supported": ["S256"],
            "grant_types_supported": ["authorization_code"]
        })

    async def oauth_register(request):
        try:
            body = await request.json()
        except:
            body = {}
        return JSONResponse({
            "client_id": "stockpro_client",
            "client_secret": "stockpro_secret",
            "client_id_issued_at": 1780066128,
            "redirect_uris": body.get("redirect_uris", ["https://claude.ai/api/mcp/auth_callback"])
        }, status_code=201)

    async def oauth_authorize(request):
        redirect_uri = request.query_params.get("redirect_uri", "https://claude.ai/api/mcp/auth_callback")
        state = request.query_params.get("state", "")
        target_url = f"{redirect_uri}?code=dummy_code&state={state}"
        return RedirectResponse(url=target_url, status_code=302)

    async def oauth_token(request):
        return JSONResponse({
            "access_token": API_KEY,
            "token_type": "Bearer",
            "expires_in": 315360000
        })

    routes = [
        # Subfolder-prefixed routes (for backwards compatibility if needed)
        Route("/mcp/sse", endpoint=handle_sse, methods=["GET", "OPTIONS"]),
        Route("/mcp/message", endpoint=handle_message, methods=["POST", "OPTIONS"]),
        Route("/mcp/.well-known/oauth-protected-resource", endpoint=oauth_protected_resource, methods=["GET"]),
        Route("/mcp/.well-known/oauth-protected-resource/sse", endpoint=oauth_protected_resource, methods=["GET"]),
        Route("/mcp/.well-known/oauth-authorization-server", endpoint=oauth_authorization_server, methods=["GET"]),
        Route("/mcp/oauth/register", endpoint=oauth_register, methods=["POST"]),
        Route("/mcp/register", endpoint=oauth_register, methods=["POST"]),
        Route("/mcp/oauth/authorize", endpoint=oauth_authorize, methods=["GET"]),
        Route("/mcp/oauth/token", endpoint=oauth_token, methods=["POST"]),
        Route("/mcp/authorize", endpoint=oauth_authorize, methods=["GET"]),

        # Root-level routes
        Route("/sse", endpoint=handle_sse, methods=["GET", "OPTIONS"]),
        Route("/message", endpoint=handle_message, methods=["POST", "OPTIONS"]),
        Route("/.well-known/oauth-protected-resource", endpoint=oauth_protected_resource, methods=["GET"]),
        Route("/.well-known/oauth-protected-resource/sse", endpoint=oauth_protected_resource, methods=["GET"]),
        Route("/.well-known/oauth-authorization-server", endpoint=oauth_authorization_server, methods=["GET"]),
        Route("/oauth/register", endpoint=oauth_register, methods=["POST"]),
        Route("/register", endpoint=oauth_register, methods=["POST"]),
        Route("/oauth/authorize", endpoint=oauth_authorize, methods=["GET"]),
        Route("/oauth/token", endpoint=oauth_token, methods=["POST"]),
        Route("/authorize", endpoint=oauth_authorize, methods=["GET"])
    ]

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"]
        )
    ]

    return Starlette(routes=routes, middleware=middleware)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "sse":
        import uvicorn
        port = int(os.environ.get("PORT", 8002))
        print(f"Starting StockPro MCP Server with API Key Authentication on port {port}...")
        app = make_custom_sse_app()
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        mcp.run()
