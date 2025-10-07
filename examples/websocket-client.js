#!/usr/bin/env node

/**
 * Example WebSocket MCP Client
 * 
 * This shows how to connect to the WebSocket MCP Proxy server
 * and use it to access all your MCP servers through a single connection.
 */

import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketTransport } from '@modelcontextprotocol/sdk/client/websocket.js';

async function main() {
  const wsUrl = process.argv[2] || 'wss://ws--websocket-mcp-proxy--4h7vh8ddvxpx.code.run';
  
  console.log(`Connecting to WebSocket MCP Proxy: ${wsUrl}`);
  
  try {
    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    
    // Create MCP transport and client
    const transport = new WebSocketTransport(ws);
    const client = new Client(
      {
        name: 'websocket-mcp-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
    
    // Connect to the proxy server
    await client.connect(transport);
    console.log('✅ Connected to WebSocket MCP Proxy');
    
    // List all available tools from all servers
    console.log('\n📋 Listing all available tools...');
    const toolsResponse = await client.request(
      { method: 'tools/list' },
      { method: 'tools/list' }
    );
    
    console.log(`Found ${toolsResponse.tools.length} tools across all servers:`);
    toolsResponse.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    
    // Example: Call a tool (replace with actual tool name)
    if (toolsResponse.tools.length > 0) {
      const firstTool = toolsResponse.tools[0];
      console.log(`\n🔧 Testing tool: ${firstTool.name}`);
      
      try {
        const result = await client.request(
          {
            method: 'tools/call',
            params: {
              name: firstTool.name,
              arguments: {} // Add appropriate arguments for the tool
            }
          },
          { method: 'tools/call' }
        );
        
        console.log('✅ Tool call successful:', result);
      } catch (error) {
        console.log('⚠️ Tool call failed (expected for demo):', error.message);
      }
    }
    
    // Close connection
    await client.close();
    console.log('\n✅ Disconnected from WebSocket MCP Proxy');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch(console.error);
