# WebSocket MCP Proxy Server

A WebSocket-based Model Context Protocol (MCP) server that can host multiple MCP servers and act as a reverse proxy, routing requests to the appropriate backend servers.

## Features

- **Multi-Server Hosting**: Host multiple MCP servers simultaneously
- **WebSocket Transport**: Real-time bidirectional communication
- **Reverse Proxy**: Route requests to appropriate backend servers based on tool names
- **Configuration-Driven**: YAML-based configuration for easy setup
- **Process Management**: Automatic spawning and management of MCP server processes
- **Graceful Shutdown**: Clean shutdown of all managed processes
- **Tool Namespacing**: Automatic prefixing of tool names to avoid conflicts

## Architecture

```
Client (WebSocket) → Proxy Server → Multiple MCP Servers
                                 ├── Filesystem Server
                                 ├── Git Server
                                 ├── Database Server
                                 └── Custom Servers
```

## Installation

```bash
cd websocket-mcp-proxy
npm install
```

## Configuration

Create a `config.yaml` file to define your MCP servers:

```yaml
proxy:
  port: 8080
  host: "localhost"

servers:
  - name: "filesystem"
    command: "npx"
    args: ["@modelcontextprotocol/server-filesystem", "/path/to/directory"]
    description: "File system operations"
    
  - name: "git"
    command: "npx"
    args: ["@modelcontextprotocol/server-git", "--repository", "/path/to/repo"]
    description: "Git operations"
```

### Configuration Options

#### Proxy Settings
- `proxy.port`: WebSocket server port (default: 8080)
- `proxy.host`: Host to bind to (default: "localhost")

#### Server Configuration
Each server in the `servers` array supports:
- `name`: Unique identifier for the server (used in tool routing)
- `command`: Command to execute
- `args`: Array of command arguments
- `env`: Environment variables (optional)
- `description`: Human-readable description (optional)

#### Environment Variables
Use `${VARIABLE_NAME}` syntax in configuration to reference environment variables:

```yaml
servers:
  - name: "search"
    command: "npx"
    args: ["@modelcontextprotocol/server-brave-search"]
    env:
      BRAVE_API_KEY: "${BRAVE_API_KEY}"
```

## Usage

### Starting the Server

```bash
# Using default config.yaml
npm start

# Using custom config file
npm start custom-config.yaml

# Development mode with auto-restart
npm run dev
```

### Tool Routing

Tools are automatically namespaced with their server name. For example:
- A tool `read_file` from the `filesystem` server becomes `filesystem:read_file`
- A tool `commit` from the `git` server becomes `git:commit`

### Client Connection

Connect to the WebSocket server at `ws://localhost:8080` and use standard MCP protocol messages.

## Examples

### Simple Setup

See `examples/simple-config.yaml` for a minimal configuration with just a filesystem server.

### Advanced Setup

See `examples/advanced-config.yaml` for a comprehensive setup with multiple server types.

### Client Example

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  // List available tools
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Received:', response);
  
  if (response.id === 1 && response.result) {
    // Call a tool from the filesystem server
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'filesystem:read_file',
        arguments: { path: '/path/to/file.txt' }
      }
    }));
  }
});
```

## API Reference

### MCP Protocol Support

The proxy server implements the standard MCP protocol:

- `tools/list`: Lists all tools from all configured servers
- `tools/call`: Calls a specific tool on the appropriate server
- `resources/list`: Lists all resources (if supported by backend servers)
- `resources/read`: Reads a specific resource

### Tool Naming Convention

Tools are prefixed with their server name using the format: `{serverName}:{toolName}`

Example:
- Original tool: `read_file`
- Proxied tool: `filesystem:read_file`

## Development

### Project Structure

```
src/
├── server.js              # Main proxy server implementation
├── config-validator.js    # Configuration validation
└── websocket-transport.js # WebSocket transport layer

examples/
├── simple-config.yaml     # Basic configuration example
└── advanced-config.yaml   # Advanced configuration example

config.yaml                # Default configuration file
```

### Adding Custom Servers

1. Create your MCP server following the MCP specification
2. Add it to the `servers` array in your configuration
3. Restart the proxy server

### Testing

```bash
npm test
```

## Troubleshooting

### Common Issues

1. **Server won't start**: Check that all configured MCP servers are available and their commands are valid
2. **Tool not found**: Ensure you're using the correct namespaced tool name (`serverName:toolName`)
3. **Connection refused**: Verify the WebSocket port is not in use by another process

### Logging

Set the logging level in your configuration:

```yaml
logging:
  level: "debug"  # Options: error, warn, info, debug
```

### Process Management

The proxy server automatically manages child processes for each MCP server. If a server crashes, it will be removed from the available servers list.

## Security Considerations

- The proxy server runs MCP servers as child processes with the same privileges
- Consider running in a containerized environment for isolation
- Use environment variables for sensitive configuration like API keys
- Implement proper access controls for the WebSocket endpoint in production

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please create an issue in the GitHub repository.
