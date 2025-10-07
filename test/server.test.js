import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ConfigValidator } from '../src/config-validator.js';

describe('ConfigValidator', () => {
  test('validates valid configuration', () => {
    const config = {
      proxy: {
        port: 8080,
        host: 'localhost'
      },
      servers: [
        {
          name: 'test-server',
          command: 'node',
          args: ['test.js'],
          description: 'Test server'
        }
      ]
    };
    
    const result = ConfigValidator.validate(config);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });
  
  test('rejects invalid port', () => {
    const config = {
      proxy: {
        port: 'invalid',
        host: 'localhost'
      },
      servers: []
    };
    
    const result = ConfigValidator.validate(config);
    assert.strictEqual(result.isValid, false);
    assert(result.errors.some(error => error.includes('proxy.port')));
  });
  
  test('rejects duplicate server names', () => {
    const config = {
      proxy: {
        port: 8080,
        host: 'localhost'
      },
      servers: [
        { name: 'duplicate', command: 'node' },
        { name: 'duplicate', command: 'python' }
      ]
    };
    
    const result = ConfigValidator.validate(config);
    assert.strictEqual(result.isValid, false);
    assert(result.errors.some(error => error.includes('Duplicate server names')));
  });
  
  test('rejects server names with colons', () => {
    const config = {
      proxy: {
        port: 8080,
        host: 'localhost'
      },
      servers: [
        { name: 'invalid:name', command: 'node' }
      ]
    };
    
    const result = ConfigValidator.validate(config);
    assert.strictEqual(result.isValid, false);
    assert(result.errors.some(error => error.includes('cannot contain colons')));
  });
  
  test('expands environment variables', () => {
    process.env.TEST_VAR = 'test-value';
    
    const config = {
      servers: [
        {
          name: 'test',
          command: 'node',
          env: {
            API_KEY: '${TEST_VAR}'
          }
        }
      ]
    };
    
    const expanded = ConfigValidator.expandEnvironmentVariables(config);
    assert.strictEqual(expanded.servers[0].env.API_KEY, 'test-value');
    
    delete process.env.TEST_VAR;
  });
});
