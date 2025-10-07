#!/usr/bin/env node

import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigValidator } from './config-validator.js';
import { HttpTransport } from './http-transport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPProxyServer {
  constructor(configPath = 'config.yaml') {
    this.config = this.loadConfig(configPath);
    this.mcpServers = new Map();
    this.clientConnections = new Map();
    this.server = new Server(
      {
        name: 'websocket-mcp-proxy',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  loadConfig(configPath) {
    const fullPath = path.resolve(configPath);
    if (!existsSync(fullPath)) {
      console.error(`Config file not found: ${fullPath}`);
      process.exit(1);
    }
    
    try {
      const configContent = readFileSync(fullPath, 'utf8');
      let config = parse(configContent);
      
      // Expand environment variables
      config = ConfigValidator.expandEnvironmentVariables(config);
      
      // Validate configuration
      const validation = ConfigValidator.validate(config);
      if (!validation.isValid) {
        console.error('Configuration validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
      }
      
      return config;
    } catch (error) {
      console.error(`Error loading config: ${error.message}`);
      process.exit(1);
    }
  }

  async startMCPServer(serverConfig) {
    const { name, type = 'STDIO' } = serverConfig;
    
    console.log(`Starting MCP server: ${name} (${type})`);
    
    try {
      if (type === 'STDIO') {
        return await this.startStdioServer(serverConfig);
      } else if (type === 'SSE' || type === 'STREAMABLE_HTTP') {
        return await this.startHttpServer(serverConfig);
      } else {
        throw new Error(`Unsupported server type: ${type}`);
      }
    } catch (error) {
      console.error(`Failed to start MCP server ${name}:`, error);
      throw error;
    }
  }

  async startStdioServer(serverConfig) {
    const { name, command, args = [], env = {} } = serverConfig;
    
    const childProcess = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const transport = new StdioServerTransport();
    const server = new Server(
      { name: `proxy-${name}`, version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    );

    // Connect to the spawned process
    await transport.start(childProcess.stdout, childProcess.stdin);
    await server.connect(transport);

    this.mcpServers.set(name, {
      server,
      transport,
      process: childProcess,
      config: serverConfig,
      type: 'STDIO'
    });

    childProcess.on('exit', (code) => {
      console.log(`MCP server ${name} exited with code ${code}`);
      this.mcpServers.delete(name);
    });

    return server;
  }

  async startHttpServer(serverConfig) {
    const { name } = serverConfig;
    
    try {
      const transport = new HttpTransport(serverConfig);
      await transport.connect();

      // Create a proxy server that handles HTTP/SSE communication
      const server = {
        name: `proxy-${name}`,
        type: serverConfig.type,
        transport,
        
        async request(request) {
          try {
            return await transport.send(request);
          } catch (error) {
            console.error(`Request failed for ${name}:`, error.message);
            throw new Error(`Server ${name} is unavailable: ${error.message}`);
          }
        }
      };

      this.mcpServers.set(name, {
        server,
        transport,
        config: serverConfig,
        type: serverConfig.type
      });

      transport.on('error', (error) => {
        console.warn(`HTTP transport error for ${name}:`, error.message);
      });

      transport.on('disconnect', () => {
        console.log(`HTTP server ${name} disconnected`);
        this.mcpServers.delete(name);
      });

      return server;
    } catch (error) {
      console.warn(`Failed to start HTTP server ${name}, skipping:`, error.message);
      // Return a dummy server that reports unavailability
      return {
        name: `proxy-${name}`,
        type: serverConfig.type,
        async request() {
          throw new Error(`Server ${name} is unavailable`);
        }
      };
    }
  }

  async initializeMCPServers() {
    const promises = this.config.servers.map(async (serverConfig) => {
      try {
        return await this.startMCPServer(serverConfig);
      } catch (error) {
        console.warn(`Failed to initialize server ${serverConfig.name}:`, error.message);
        return null;
      }
    });
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    
    console.log(`Initialized ${successful}/${this.config.servers.length} MCP servers`);
    console.log(`Active servers: ${Array.from(this.mcpServers.keys()).join(', ')}`);
  }

  setupHandlers() {
    // List all tools from all MCP servers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [];
      
      for (const [serverName, { server, type }] of this.mcpServers) {
        try {
          let response;
          
          if (type === 'STDIO') {
            response = await server.request(
              { method: 'tools/list' },
              ListToolsRequestSchema
            );
          } else {
            // HTTP/SSE servers
            response = await server.request({
              jsonrpc: '2.0',
              method: 'tools/list',
              id: `list-${Date.now()}`,
              params: {}
            });
          }
          
          // Handle different response formats
          const tools = response.tools || response.result?.tools || [];
          
          // Prefix tool names with server name to avoid conflicts
          const prefixedTools = tools.map(tool => ({
            ...tool,
            name: `${serverName}:${tool.name}`,
            description: `[${serverName}] ${tool.description || ''}`
          }));
          
          allTools.push(...prefixedTools);
        } catch (error) {
          console.error(`Error listing tools from ${serverName}:`, error);
        }
      }
      
      return { tools: allTools };
    });

    // Route tool calls to appropriate MCP server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: toolArgs } = request.params;
      
      // Parse server name from tool name (format: serverName:toolName)
      const [serverName, actualToolName] = toolName.split(':', 2);
      
      if (!serverName || !actualToolName) {
        throw new Error(`Invalid tool name format: ${toolName}. Expected format: serverName:toolName`);
      }
      
      const mcpServer = this.mcpServers.get(serverName);
      if (!mcpServer) {
        throw new Error(`MCP server not found: ${serverName}`);
      }
      
      try {
        let response;
        
        if (mcpServer.type === 'STDIO') {
          response = await mcpServer.server.request(
            {
              method: 'tools/call',
              params: {
                name: actualToolName,
                arguments: toolArgs
              }
            },
            CallToolRequestSchema
          );
        } else {
          // HTTP/SSE servers
          response = await mcpServer.server.request({
            jsonrpc: '2.0',
            method: 'tools/call',
            id: `call-${Date.now()}`,
            params: {
              name: actualToolName,
              arguments: toolArgs
            }
          });
        }
        
        // Normalize response format
        return response.result ? response : { content: response };
      } catch (error) {
        console.error(`Error calling tool ${actualToolName} on server ${serverName}:`, error);
        throw error;
      }
    });
  }

  async startWebSocketServer() {
    const port = this.config.proxy?.port || 8080;
    const host = this.config.proxy?.host || '0.0.0.0';
    
    // Create HTTP server for health checks and WebSocket upgrade
    const http = await import('http');
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          servers: Array.from(this.mcpServers.keys()),
          totalServers: this.mcpServers.size,
          timestamp: new Date().toISOString()
        }));
      } else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>WebSocket MCP Proxy</title></head>
            <body>
              <h1>WebSocket MCP Proxy Server</h1>
              <p>Status: <strong>Running</strong></p>
              <p>Active Servers: <strong>${this.mcpServers.size}</strong></p>
              <p>WebSocket Endpoint: <code>wss://${req.headers.host}</code></p>
              <p>Health Check: <a href="/health">/health</a></p>
              <h3>Available Servers:</h3>
              <ul>
                ${Array.from(this.mcpServers.keys()).map(name => `<li>${name}</li>`).join('')}
              </ul>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    
    const wss = new WebSocketServer({ server });
    
    server.listen(port, host, () => {
      console.log(`WebSocket MCP Proxy Server listening on ${host}:${port}`);
      console.log(`Health check available at: http://${host}:${port}/health`);
      console.log(`WebSocket endpoint: ws://${host}:${port}`);
    });
    
    wss.on('connection', (ws) => {
      const connectionId = uuidv4();
      console.log(`New WebSocket connection: ${connectionId}`);
      
      // Create a new server instance for this connection
      const connectionServer = new Server(
        {
          name: 'websocket-mcp-proxy',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        }
      );
      
      // Copy handlers from main server
      connectionServer.setRequestHandler(ListToolsRequestSchema, 
        this.server.getRequestHandler(ListToolsRequestSchema)
      );
      connectionServer.setRequestHandler(CallToolRequestSchema, 
        this.server.getRequestHandler(CallToolRequestSchema)
      );
      
      // Set up WebSocket transport
      const transport = {
        start: async () => {},
        send: async (message) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(message));
          }
        },
        close: async () => {
          ws.close();
        }
      };
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await connectionServer.handleMessage(message, transport);
        } catch (error) {
          console.error(`Error handling message from ${connectionId}:`, error);
        }
      });
      
      ws.on('close', () => {
        console.log(`WebSocket connection closed: ${connectionId}`);
        this.clientConnections.delete(connectionId);
      });
      
      this.clientConnections.set(connectionId, { ws, server: connectionServer });
    });
    
    return wss;
  }

  async start() {
    try {
      console.log('Starting WebSocket MCP Proxy Server...');
      
      // Initialize all configured MCP servers
      await this.initializeMCPServers();
      
      // Start WebSocket server
      await this.startWebSocketServer();
      
      console.log('WebSocket MCP Proxy Server started successfully');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
      
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('Shutting down WebSocket MCP Proxy Server...');
    
    // Close all MCP server processes
    for (const [name, { process, transport }] of this.mcpServers) {
      console.log(`Stopping MCP server: ${name}`);
      try {
        await transport.close();
        process.kill();
      } catch (error) {
        console.error(`Error stopping MCP server ${name}:`, error);
      }
    }
    
    // Close all client connections
    for (const [connectionId, { ws }] of this.clientConnections) {
      ws.close();
    }
    
    console.log('Server shutdown complete');
    process.exit(0);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.argv[2] || 'config.yaml';
  const proxyServer = new MCPProxyServer(configPath);
  proxyServer.start();
}

export default MCPProxyServer;
