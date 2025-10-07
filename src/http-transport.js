import { EventEmitter } from 'events';

/**
 * HTTP Transport for MCP servers that use HTTP/SSE protocols
 * Handles STREAMABLE_HTTP and SSE server types
 */
export class HttpTransport extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.url = config.url;
    this.headers = this.buildHeaders();
    this.connected = false;
    this.eventSource = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'WebSocket-MCP-Proxy/1.0.0'
    };

    // Add authentication headers
    if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    // Add custom headers from environment
    if (this.config.env) {
      Object.entries(this.config.env).forEach(([key, value]) => {
        if (key.toLowerCase().includes('header') || key === 'Authorization') {
          headers[key] = value;
        }
      });
    }

    return headers;
  }

  async connect() {
    if (this.connected) return;

    try {
      if (this.config.type === 'SSE') {
        await this.connectSSE();
      } else if (this.config.type === 'STREAMABLE_HTTP') {
        await this.connectHTTP();
      }
      
      this.connected = true;
      this.emit('connect');
      console.log(`[HTTP Transport] Connected to ${this.config.name} (${this.config.type})`);
    } catch (error) {
      console.warn(`[HTTP Transport] Failed to connect to ${this.config.name}:`, error.message);
      // Mark as connected anyway - we'll handle errors per request
      this.connected = true;
      this.emit('connect');
    }
  }

  async connectSSE() {
    // For SSE, we establish a persistent connection
    const EventSource = (await import('eventsource')).default;
    
    const eventSourceUrl = new URL(this.url);
    
    this.eventSource = new EventSource(eventSourceUrl.toString(), {
      headers: this.headers
    });

    this.eventSource.onopen = () => {
      console.log(`[SSE] Connected to ${this.config.name}`);
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error(`[SSE] Error parsing message from ${this.config.name}:`, error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error(`[SSE] Error from ${this.config.name}:`, error);
      this.emit('error', error);
    };
  }

  async connectHTTP() {
    // For STREAMABLE_HTTP, we test the connection with a ping/health check
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 'init-' + Date.now(),
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              roots: { listChanged: true },
              sampling: {}
            },
            clientInfo: {
              name: 'WebSocket-MCP-Proxy',
              version: '1.0.0'
            }
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[HTTP] Connected to ${this.config.name}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Connection timeout to ${this.config.name}`);
      }
      console.error(`[HTTP] Failed to connect to ${this.config.name}:`, error);
      throw error;
    }
  }

  async send(message) {
    if (!this.connected) {
      throw new Error(`Transport not connected for ${this.config.name}`);
    }

    const requestId = message.id || `req-${++this.requestId}`;
    message.id = requestId;

    try {
      if (this.config.type === 'SSE') {
        return await this.sendSSE(message);
      } else if (this.config.type === 'STREAMABLE_HTTP') {
        return await this.sendHTTP(message);
      }
    } catch (error) {
      console.error(`[${this.config.type}] Error sending message to ${this.config.name}:`, error);
      throw error;
    }
  }

  async sendSSE(message) {
    // For SSE, we typically send via a separate HTTP endpoint
    const postUrl = this.url.replace('/sse', '/send') || this.url + '/send';
    
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`SSE POST failed: ${response.status} ${response.statusText}`);
    }

    // For SSE, the response comes via the event stream
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error('SSE request timeout'));
      }, 30000);

      this.pendingRequests.set(message.id, { resolve, reject, timeout });
    });
  }

  async sendHTTP(message) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType && contentType.includes('text/')) {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { result: text };
      }
    } else {
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Try to parse complete JSON messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.id === message.id) {
                return data;
              }
            } catch (error) {
              console.warn(`[HTTP] Failed to parse streaming line:`, line);
            }
          }
        }
      }
      
      // Parse any remaining buffer
      if (buffer.trim()) {
        try {
          return JSON.parse(buffer);
        } catch (error) {
          return { result: buffer };
        }
      }
    }
  }

  handleMessage(data) {
    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, timeout } = this.pendingRequests.get(data.id);
      clearTimeout(timeout);
      this.pendingRequests.delete(data.id);
      resolve(data);
    } else {
      // Handle notifications or other messages
      this.emit('message', data);
    }
  }

  async disconnect() {
    if (!this.connected) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Clear pending requests
    for (const [id, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
      reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    this.connected = false;
    this.emit('disconnect');
    console.log(`[HTTP Transport] Disconnected from ${this.config.name}`);
  }

  isConnected() {
    return this.connected;
  }
}
