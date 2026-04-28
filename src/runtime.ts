import {
  type IncomingMessage,
  type ServerResponse,
  createServer as createHttpServer,
} from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { createServer } from './server.js';

const RuntimeConfigSchema = z.object({
  transport: z.enum(['stdio', 'streamable-http']).default('stdio'),
  host: z.string().default('127.0.0.1'),
  port: z.coerce.number().int().min(0).max(65535).default(3000),
  path: z
    .string()
    .default('/mcp')
    .transform((value) => (value.startsWith('/') ? value : `/${value}`)),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export interface StreamableHttpService {
  close(): Promise<void>;
  endpoint: string;
  host: string;
  path: string;
  port: number;
}

export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return RuntimeConfigSchema.parse({
    transport: env.MCP_TRANSPORT,
    host: env.MCP_HOST,
    port: env.MCP_PORT,
    path: env.MCP_PATH,
  });
}

function createJsonRpcError(message: string, code = -32000) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
    },
    id: null,
  };
}

function sendJsonRpcError(
  res: ServerResponse,
  statusCode: number,
  message: string,
  code = -32000
): void {
  if (res.headersSent) {
    return;
  }

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(createJsonRpcError(message, code)));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();

  if (body.length === 0) {
    return undefined;
  }

  return JSON.parse(body);
}

function formatHostForUrl(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function createStreamableHttpRequestHandler(config: Pick<RuntimeConfig, 'path'>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');

    if (requestUrl.pathname !== config.path) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJsonRpcError(res, 405, 'Method not allowed');
      return;
    }

    let parsedBody: unknown;

    try {
      parsedBody = await readJsonBody(req);
    } catch {
      sendJsonRpcError(res, 400, 'Invalid JSON body', -32700);
      return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (error) {
      console.error('Error handling MCP HTTP request:', error);
      sendJsonRpcError(res, 500, 'Internal server error', -32603);
    } finally {
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
  };
}

export async function startStreamableHttpServer(
  runtimeConfig: Partial<RuntimeConfig> = {}
): Promise<StreamableHttpService> {
  const config = RuntimeConfigSchema.parse(runtimeConfig);
  const handler = createStreamableHttpRequestHandler({ path: config.path });
  const httpServer = createHttpServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.port, config.host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine HTTP server address');
  }

  const host = address.address;
  const port = address.port;
  const endpoint = `http://${formatHostForUrl(host)}:${port}${config.path}`;

  return {
    host,
    path: config.path,
    port,
    endpoint,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

export async function runStreamableHttpServer(
  runtimeConfig: Partial<RuntimeConfig> = {}
): Promise<StreamableHttpService> {
  const config = RuntimeConfigSchema.parse(runtimeConfig);
  const service = await startStreamableHttpServer(config);

  console.error(`MCP Streamable HTTP server listening at ${service.endpoint}`);

  const shutdown = async () => {
    await service.close().catch((error) => {
      console.error('Error while shutting down MCP HTTP server:', error);
    });
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  return service;
}

export async function runServer(): Promise<void> {
  const config = getRuntimeConfig();

  if (config.transport === 'streamable-http') {
    await runStreamableHttpServer(config);
    return;
  }

  await runStdioServer();
}
