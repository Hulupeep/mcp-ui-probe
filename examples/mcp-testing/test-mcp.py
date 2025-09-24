#!/usr/bin/env python3

import json
import subprocess
import time
from typing import Dict, Any

class MCPTestClient:
    def __init__(self):
        """Start the MCP server and create a connection"""
        print("🚀 Starting UI-Probe MCP Server...")
        self.process = subprocess.Popen(
            ['npx', 'mcp-ui-probe@latest', 'start'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0
        )
        time.sleep(3)  # Wait for server to start
        self.request_id = 1

    def send_request(self, method: str, params: Dict[str, Any] = None) -> Dict:
        """Send a JSON-RPC request to the MCP server"""
        request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }
        self.request_id += 1

        print(f"\n📤 Sending: {method}")
        print(f"   Params: {json.dumps(params, indent=2)}")

        # Send request
        request_str = json.dumps(request) + '\n'
        self.process.stdin.write(request_str)
        self.process.stdin.flush()

        # Read response
        response_line = self.process.stdout.readline()
        if response_line:
            response = json.loads(response_line)
            print(f"📥 Response: {json.dumps(response, indent=2)[:500]}...")
            return response
        return {}

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict:
        """Call a specific tool"""
        return self.send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })

    def run_tests(self):
        """Run a series of test commands"""
        print("\n" + "="*50)
        print("UI-PROBE MCP PROTOCOL TEST SUITE")
        print("="*50)

        # Test 1: Initialize
        print("\n1️⃣  INITIALIZE CONNECTION")
        self.send_request("initialize", {
            "protocolVersion": "0.1.0",
            "capabilities": {}
        })

        # Test 2: List tools
        print("\n2️⃣  LIST AVAILABLE TOOLS")
        response = self.send_request("tools/list", {})
        if "result" in response:
            tools = response["result"].get("tools", [])
            print(f"   Found {len(tools)} tools:")
            for tool in tools[:5]:  # Show first 5
                print(f"   - {tool.get('name')}: {tool.get('description', '')[:60]}...")

        # Test 3: Navigate to test page
        print("\n3️⃣  NAVIGATE TO TEST PAGE")
        self.call_tool("navigate", {
            "url": "http://localhost:8081/test"
        })

        # Test 4: Analyze UI
        print("\n4️⃣  ANALYZE PAGE UI")
        result = self.call_tool("analyze_ui", {})

        # Test 5: Verify page
        print("\n5️⃣  VERIFY PAGE CONTENT")
        self.call_tool("verify_page", {
            "expectedContent": ["Test", "Form"],
            "unexpectedContent": ["404", "Error"]
        })

        # Test 6: Click button
        print("\n6️⃣  CLICK BUTTON TEST")
        self.call_tool("click_button", {
            "text": "Submit"
        })

        # Test 7: Run a flow
        print("\n7️⃣  RUN NATURAL LANGUAGE FLOW")
        self.call_tool("run_flow", {
            "goal": "Fill out the test form with sample data",
            "url": "http://localhost:8081/test/forms"
        })

        print("\n✅ All tests completed!")

    def cleanup(self):
        """Stop the server"""
        print("\nStopping server...")
        self.process.terminate()

if __name__ == "__main__":
    # Make sure test server is running first
    print("⚠️  Make sure you have the test server running:")
    print("   npx mcp-ui-probe@latest test-server")
    print("\nPress Enter to continue...")
    input()

    client = MCPTestClient()
    try:
        client.run_tests()
    finally:
        client.cleanup()