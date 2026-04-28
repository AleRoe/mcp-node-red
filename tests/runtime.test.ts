import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type StreamableHttpService,
  getRuntimeConfig,
  startStreamableHttpServer,
} from '../src/runtime.js';

describe('runtime configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_RED_URL = 'http://localhost:1880';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to stdio transport', () => {
    process.env.MCP_TRANSPORT = undefined;
    process.env.MCP_HOST = undefined;
    process.env.MCP_PORT = undefined;
    process.env.MCP_PATH = undefined;

    expect(getRuntimeConfig()).toEqual({
      transport: 'stdio',
      host: '127.0.0.1',
      port: 3000,
      path: '/mcp',
    });
  });

  it('normalizes streamable HTTP runtime options', () => {
    process.env.MCP_TRANSPORT = 'streamable-http';
    process.env.MCP_HOST = '0.0.0.0';
    process.env.MCP_PORT = '8080';
    process.env.MCP_PATH = 'api/mcp';

    expect(getRuntimeConfig()).toEqual({
      transport: 'streamable-http',
      host: '0.0.0.0',
      port: 8080,
      path: '/api/mcp',
    });
  });
});

describe('streamable HTTP runtime', () => {
  let service: StreamableHttpService | undefined;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_RED_URL = 'http://localhost:1880';
  });

  afterEach(async () => {
    if (service) {
      await service.close();
      service = undefined;
    }

    process.env = originalEnv;
  });

  it('serves MCP requests over HTTP', async () => {
    service = await startStreamableHttpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
    });

    const client = new Client({ name: 'http-test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(service.endpoint));

    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toContain('get_flows');
    expect(toolNames).toContain('delete_flow');

    await client.close();
  });

  it('rejects unsupported methods', async () => {
    service = await startStreamableHttpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
    });

    const getResponse = await fetch(service.endpoint, { method: 'GET' });
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get('allow')).toBe('POST');

    const deleteResponse = await fetch(service.endpoint, { method: 'DELETE' });
    expect(deleteResponse.status).toBe(405);
  });

  it('returns 404 for other paths', async () => {
    service = await startStreamableHttpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
    });

    const response = await fetch(`${service.endpoint}/other`, { method: 'POST' });
    expect(response.status).toBe(404);
  });
});
