import { EventEmitter } from 'events';

export class WebSocketTransport extends EventEmitter {
  constructor(ws) {
    super();
    this.ws = ws;
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('message', message);
      } catch (error) {
        this.emit('error', new Error(`Invalid JSON message: ${error.message}`));
      }
    });
    
    this.ws.on('close', () => {
      this.emit('close');
    });
    
    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  async start() {
    // WebSocket is already connected when this transport is created
    return Promise.resolve();
  }
  
  async send(message) {
    if (this.ws.readyState === this.ws.constructor.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not open');
    }
  }
  
  async close() {
    this.ws.close();
  }
}
