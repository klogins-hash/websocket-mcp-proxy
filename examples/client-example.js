#!/usr/bin/env node

import WebSocket from 'ws';

class MCPProxyClient {
  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        console.log('Connected to MCP Proxy Server');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });
      
      this.ws.on('close', () => {
        console.log('Disconnected from MCP Proxy Server');
      });
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error.message || 'Unknown error'));
        } else {
          resolve(message.result);
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      this.pendingRequests.set(id, { resolve, reject });
      
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      this.ws.send(JSON.stringify(message));
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async listTools() {
    return this.sendRequest('tools/list');
  }

  async callTool(name, args = {}) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Example usage
async function example() {
  const client = new MCPProxyClient();
  
  try {
    await client.connect();
    
    // List all available tools
    console.log('Listing available tools...');
    const toolsResponse = await client.listTools();
    console.log('Available tools:');
    toolsResponse.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
    });
    
    // Example: Call a filesystem tool (if available)
    const filesystemTools = toolsResponse.tools.filter(t => t.name.startsWith('filesystem:'));
    if (filesystemTools.length > 0) {
      console.log('\nTrying to call a filesystem tool...');
      try {
        const result = await client.callTool('filesystem:list_directory', { path: '.' });
        console.log('Directory listing result:', result);
      } catch (error) {
        console.log('Filesystem tool call failed:', error.message);
      }
    }
    
    // Example: Call a git tool (if available)
    const gitTools = toolsResponse.tools.filter(t => t.name.startsWith('git:'));
    if (gitTools.length > 0) {
      console.log('\nTrying to call a git tool...');
      try {
        const result = await client.callTool('git:status', {});
        console.log('Git status result:', result);
      } catch (error) {
        console.log('Git tool call failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}

export default MCPProxyClient;
