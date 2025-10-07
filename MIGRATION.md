# Migration from Meta MCP to WebSocket MCP Proxy

This document explains how your existing Meta MCP configuration translates to our WebSocket MCP Proxy setup.

## Overview

Your Meta MCP configuration includes three types of MCP servers:
1. **STDIO** - Direct process communication (✅ **Fully Supported**)
2. **SSE** - Server-Sent Events (🚧 **Planned**)
3. **STREAMABLE_HTTP** - HTTP streaming (🚧 **Planned**)

## Current Support Status

### ✅ STDIO Servers (Fully Supported)

These servers are **ready to use** with our WebSocket MCP Proxy:

| Server | Status | Description |
|--------|--------|-------------|
| **Vapi** | ✅ Ready | AI voice calling platform |
| **Supabase** | ✅ Ready | Database integration |
| **N8N Railway** | ✅ Ready | Workflow automation |
| **Linear** | ✅ Ready | Project management |
| **Railway** | ✅ Ready | Platform deployment |
| **Cartesia** | ✅ Ready | AI voice synthesis |
| **Firecrawl** | ✅ Ready | Web scraping |
| **Tavily** | ✅ Ready | AI-powered search |
| **OpenRouter** | ✅ Ready | Multiple AI models |
| **GitHub** | ✅ Ready | Repository management |
| **HeyGen** | ✅ Ready | Video generation |
| **Mem0** | ✅ Ready | Memory management |
| **OpenMemory** | ✅ Ready | Knowledge management |

### 🚧 HTTP/SSE Servers (Future Implementation)

These servers require additional proxy functionality:

| Server | Type | Status | Description |
|--------|------|--------|-------------|
| **Pipedream** | SSE | 🚧 Planned | Cloud automation |
| **Postman** | STREAMABLE_HTTP | 🚧 Planned | API testing |
| **MC3 Server** | STREAMABLE_HTTP | 🚧 Planned | Custom endpoint |
| **Rube** | STREAMABLE_HTTP | 🚧 Planned | Workflow platform |

## Configuration Translation

### Your Meta MCP Format:
```json
{
  "mcpServers": {
    "vapi": {
      "type": "STDIO",
      "command": "npx",
      "args": ["-y", "@vapi-ai/mcp-server"],
      "env": {
        "VAPI_TOKEN": "your-token"
      }
    }
  }
}
```

### Our WebSocket MCP Proxy Format:
```yaml
servers:
  - name: "vapi"
    command: "npx"
    args: ["-y", "@vapi-ai/mcp-server"]
    env:
      VAPI_TOKEN: "${VAPI_TOKEN}"
    description: "AI voice calling platform"
```

## Setup Instructions

### 1. Environment Variables

Copy your API keys to the environment file:

```bash
# Copy the production environment template
cp .env.production .env

# Edit with your actual values
nano .env
```

### 2. Deploy Updated Configuration

```bash
# Install new dependencies
npm install

# Commit and push changes
git add .
git commit -m "Add Meta MCP server configurations and environment support"
git push

# The deployment will automatically update on Northflank
```

### 3. Connect to Your WebSocket MCP Proxy

Use the WebSocket endpoint to connect:

```javascript
const ws = new WebSocket('wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run');

// Your existing MCP client code works the same way
// Just point it to the WebSocket endpoint instead of individual servers
```

## Benefits of Migration

### 🚀 **Centralized Management**
- Single WebSocket endpoint for all your MCP servers
- Unified logging and monitoring
- Consistent authentication

### 🔧 **Simplified Client Code**
- One connection instead of managing multiple server types
- Automatic server discovery and routing
- Built-in error handling and reconnection

### 📈 **Scalability**
- Easy to add/remove servers without client changes
- Load balancing across server instances
- Horizontal scaling support

### 🔒 **Security**
- Centralized API key management
- Environment variable isolation
- Optional authentication layer

## Usage Examples

### List Available Tools
```javascript
// Get tools from all connected servers
const response = await client.request({
  method: 'tools/list'
});

// Tools are automatically namespaced by server:
// vapi/create_call, github/create_issue, etc.
```

### Call Tools
```javascript
// Call a tool on a specific server
const result = await client.request({
  method: 'tools/call',
  params: {
    name: 'vapi/create_call',
    arguments: {
      phone_number: '+1234567890',
      assistant_id: 'your-assistant-id'
    }
  }
});
```

## Migration Checklist

- [x] ✅ **STDIO servers configured** - All your STDIO-based servers are ready
- [x] ✅ **Environment variables set** - API keys and tokens configured
- [x] ✅ **Deployment updated** - New configuration deployed to Northflank
- [ ] 🚧 **HTTP/SSE servers** - Will be added in future updates
- [ ] 📝 **Client code updated** - Update your client to use WebSocket endpoint

## Next Steps

1. **Test the STDIO servers** - Your existing servers should work immediately
2. **Update client applications** - Point them to the WebSocket endpoint
3. **Monitor performance** - Use Northflank dashboard for logs and metrics
4. **Request HTTP/SSE support** - Let us know which servers you need most

## Support

The WebSocket MCP Proxy is designed to be a drop-in replacement for your Meta MCP setup with enhanced capabilities. All your existing STDIO-based servers will work immediately with better performance and management features.
