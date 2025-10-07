import { existsSync } from 'fs';

export class ConfigValidator {
  static validate(config) {
    const errors = [];
    
    // Validate proxy configuration
    if (!config.proxy) {
      errors.push('Missing proxy configuration');
    } else {
      if (!config.proxy.port || typeof config.proxy.port !== 'number') {
        errors.push('Invalid or missing proxy.port');
      }
      if (config.proxy.port < 1 || config.proxy.port > 65535) {
        errors.push('proxy.port must be between 1 and 65535');
      }
    }
    
    // Validate servers configuration
    if (!config.servers || !Array.isArray(config.servers)) {
      errors.push('Missing or invalid servers configuration');
    } else {
      config.servers.forEach((server, index) => {
        const serverErrors = this.validateServer(server, index);
        errors.push(...serverErrors);
      });
    }
    
    // Check for duplicate server names
    if (config.servers) {
      const names = config.servers.map(s => s.name);
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate server names found: ${duplicates.join(', ')}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateServer(server, index) {
    const errors = [];
    const prefix = `servers[${index}]`;
    
    if (!server.name || typeof server.name !== 'string') {
      errors.push(`${prefix}: Missing or invalid name`);
    }
    
    // Validate server name format (no colons allowed as they're used for routing)
    if (server.name && server.name.includes(':')) {
      errors.push(`${prefix}: Server name cannot contain colons (:)`);
    }
    
    // Validate based on server type
    const type = server.type || 'STDIO';
    const validTypes = ['STDIO', 'SSE', 'STREAMABLE_HTTP'];
    
    if (!validTypes.includes(type)) {
      errors.push(`${prefix}: Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (type === 'STDIO') {
      // STDIO servers need command and args
      if (!server.command || typeof server.command !== 'string') {
        errors.push(`${prefix}: Missing or invalid command for STDIO server`);
      }
      
      if (server.args && !Array.isArray(server.args)) {
        errors.push(`${prefix}: args must be an array for STDIO server`);
      }
    } else if (type === 'SSE' || type === 'STREAMABLE_HTTP') {
      // HTTP/SSE servers need URL
      if (!server.url || typeof server.url !== 'string') {
        errors.push(`${prefix}: Missing or invalid url for ${type} server`);
      }
      
      // Validate URL format
      if (server.url) {
        try {
          new URL(server.url);
        } catch {
          errors.push(`${prefix}: Invalid URL format for ${type} server`);
        }
      }
    }
    
    if (server.env && typeof server.env !== 'object') {
      errors.push(`${prefix}: env must be an object`);
    }
    
    return errors;
  }
  
  static expandEnvironmentVariables(config) {
    const configStr = JSON.stringify(config);
    const expandedStr = configStr.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
    return JSON.parse(expandedStr);
  }
}
