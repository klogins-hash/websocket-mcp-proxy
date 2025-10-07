# WebSocket MCP Proxy Usage Guide

## 🚨 Important: Connection Protocol

The WebSocket MCP Proxy uses **WebSocket connections**, not HTTP. You cannot connect to it using standard HTTP MCP clients.

### ✅ Correct Usage

**WebSocket Endpoint:**
```
wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run
```

**Health Check (HTTP):**
```
https://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run/health
```

### ❌ Incorrect Usage

Do NOT try to use the WebSocket URL with HTTP-based MCP clients:
- ❌ `mcp-remote wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run`
- ❌ HTTP POST requests to WebSocket URL
- ❌ SSE connections to WebSocket URL

## 🔧 How to Connect

### Option 1: Use WebSocket MCP Client

```javascript
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketTransport } from '@modelcontextprotocol/sdk/client/websocket.js';

const ws = new WebSocket('wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run');
const transport = new WebSocketTransport(ws);
const client = new Client({ name: 'my-client', version: '1.0.0' }, { capabilities: {} });

await client.connect(transport);
```

### Option 2: Use in Windsurf Cascade

Add this to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "websocket-mcp-proxy": {
      "type": "WEBSOCKET",
      "url": "wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run"
    }
  }
}
```

### Option 3: Raw WebSocket Connection

```javascript
const ws = new WebSocket('wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run');

ws.on('open', () => {
  // Send MCP JSON-RPC messages
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
});
```

## 🛠️ Available Tools

All tools are namespaced by server name. Format: `serverName:toolName`

### STDIO Servers (Always Available)
- `vapi:*` - AI voice calling platform
- `github:*` - GitHub repository management
- `linear:*` - Project management
- `tavily:*` - AI-powered search
- `firecrawl:*` - Web scraping
- `openrouter:*` - Multiple AI models
- And more...

### HTTP/SSE Servers (When Available)
- `pipedream:*` - Cloud automation
- `postman:*` - API testing
- `mc3-server:*` - Custom endpoint
- `rube:*` - Workflow platform

## 🔍 Health Check

Check server status and available servers:

```bash
curl https://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run/health
```

Response:
```json
{
  "status": "healthy",
  "servers": ["vapi", "github", "linear", "tavily", ...],
  "totalServers": 15,
  "timestamp": "2025-10-07T21:30:00.000Z"
}
```

## 🚀 Example Usage

```javascript
// List all tools
const tools = await client.request({ method: 'tools/list' });

// Call a specific tool
const result = await client.request({
  method: 'tools/call',
  params: {
    name: 'github:create_issue',
    arguments: {
      title: 'Bug report',
      body: 'Description of the bug'
    }
  }
});
```

## 🛡️ Fault Isolation

The proxy is designed with fault isolation:
- ✅ If one server fails, others continue working
- ✅ Failed servers are marked as unavailable but don't crash the proxy
- ✅ Individual tool failures don't affect other tools
- ✅ Connection issues are handled gracefully

## 📝 Troubleshooting

### "Unsupported protocol scheme 'wss'"
- ❌ You're using an HTTP-based MCP client with a WebSocket URL
- ✅ Use a WebSocket-compatible MCP client or the provided examples

### "Connection refused"
- Check the health endpoint: `https://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run/health`
- Verify the WebSocket URL is correct
- Check if the service is running on Northflank

### "Server not found"
- Use `serverName:toolName` format for tool calls
- Check available servers with `/health` endpoint
- Some HTTP/SSE servers may be unavailable due to network issues
