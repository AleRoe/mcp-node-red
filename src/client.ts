import { request } from 'undici';
import { z } from 'zod';
import type {
  Config,
  FlowState,
  NodeCatalogue,
  NodeModule,
  NodeRedCreateFlowRequest,
  NodeRedDiagnostics,
  NodeRedFlowsResponse,
  NodeRedSettings,
  NodeRedUpdateFlowRequest,
} from './schemas.js';
import {
  FlowStateSchema,
  NodeCatalogueSchema,
  NodeModuleSchema,
  NodeRedDiagnosticsSchema,
  NodeRedFlowsResponseSchema,
  NodeRedSettingsSchema,
} from './schemas.js';

export class NodeRedClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly basicAuth?: string;
  private readonly catalogueUrl: string;

  constructor(config: Config) {
    const url = new URL(config.nodeRedUrl);

    // Extract basic auth from URL if present
    if (url.username || url.password) {
      this.basicAuth = Buffer.from(`${url.username}:${url.password}`).toString('base64');
      url.username = '';
      url.password = '';
    }

    this.baseUrl = url.toString().replace(/\/$/, '');
    this.token = config.nodeRedToken;
    this.catalogueUrl =
      config.nodeRedCatalogueUrl ?? 'https://catalogue.nodered.org/catalogue.json';
  }

  private getHeaders(options: HeaderOptions = {}): Record<string, string> {
    const headers: Record<string, string> = {};

    if (options.contentType !== false) {
      headers['Content-Type'] = options.contentType ?? 'application/json';
    }

    headers['Node-RED-API-Version'] = options.apiVersion ?? 'v2';

    if (options.accept) {
      headers.Accept = options.accept;
    }

    if (options.deploymentType) {
      headers['Node-RED-Deployment-Type'] = options.deploymentType;
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    } else if (this.basicAuth) {
      headers.Authorization = `Basic ${this.basicAuth}`;
    }

    return headers;
  }

  async getFlows(): Promise<NodeRedFlowsResponse> {
    const response = await request(`${this.baseUrl}/flows`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get flows: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return NodeRedFlowsResponseSchema.parse(data);
  }

  async createFlow(flowData: NodeRedCreateFlowRequest): Promise<{ id?: string }> {
    // This uses POST /flow to add a single tab, not POST /flows bulk deployment.
    const response = await request(`${this.baseUrl}/flow`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(flowData),
    });

    if (response.statusCode !== 200 && response.statusCode !== 204) {
      const body = await response.body.text();
      throw new Error(`Failed to create flow: ${response.statusCode}\n${body}`);
    }

    if (response.statusCode === 204) {
      return flowData.id ? { id: flowData.id } : {};
    }
    const data = await response.body.json();
    return data as { id?: string };
  }

  async updateFlow(flowId: string, flowData: NodeRedUpdateFlowRequest): Promise<{ id: string }> {
    const response = await request(`${this.baseUrl}/flow/${flowId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(flowData),
    });

    if (response.statusCode !== 200 && response.statusCode !== 204) {
      const body = await response.body.text();
      throw new Error(`Failed to update flow: ${response.statusCode}\n${body}`);
    }

    if (response.statusCode === 204) {
      return { id: flowId };
    }
    const data = await response.body.json();
    return data as { id: string };
  }

  async deleteFlow(flowId: string): Promise<void> {
    const response = await request(`${this.baseUrl}/flow/${flowId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 204) {
      const body = await response.body.text();
      throw new Error(`Failed to delete flow: ${response.statusCode}\n${body}`);
    }
  }

  async getFlowState(): Promise<FlowState> {
    const response = await request(`${this.baseUrl}/flows/state`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get flow state: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return FlowStateSchema.parse(data);
  }

  async setFlowState(state: 'start' | 'stop'): Promise<FlowState> {
    const response = await request(`${this.baseUrl}/flows/state`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ state }),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to set flow state: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return FlowStateSchema.parse(data);
  }

  async getSettings(): Promise<NodeRedSettings> {
    const response = await request(`${this.baseUrl}/settings`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get settings: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return NodeRedSettingsSchema.parse(data);
  }

  async getDiagnostics(): Promise<NodeRedDiagnostics> {
    const response = await request(`${this.baseUrl}/diagnostics`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get diagnostics: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return NodeRedDiagnosticsSchema.parse(data);
  }

  async getContext(
    scope: 'global' | 'flow' | 'node',
    id?: string,
    key?: string,
    store?: string
  ): Promise<unknown> {
    let url = `${this.baseUrl}/context/${scope}`;
    if (scope !== 'global' && id) {
      url += `/${id}`;
    }
    if (key) {
      url += `/${key}`;
    }
    if (store) {
      url += `?store=${encodeURIComponent(store)}`;
    }

    const response = await request(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get context: ${response.statusCode}\n${body}`);
    }

    return await response.body.json();
  }

  async deleteContext(
    scope: 'global' | 'flow' | 'node',
    id?: string,
    key?: string,
    store?: string
  ): Promise<void> {
    let url = `${this.baseUrl}/context/${scope}`;
    if (scope === 'global') {
      url += `/${key}`;
    } else {
      url += `/${id}/${key}`;
    }
    if (store) {
      url += `?store=${encodeURIComponent(store)}`;
    }

    const response = await request(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 204) {
      const body = await response.body.text();
      throw new Error(`Failed to delete context: ${response.statusCode}\n${body}`);
    }
  }

  async triggerInject(nodeId: string): Promise<void> {
    const response = await request(`${this.baseUrl}/inject/${nodeId}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to trigger inject node: ${response.statusCode}\n${body}`);
    }
  }

  async setDebugNodeState(nodeId: string, enabled: boolean): Promise<void> {
    const action = enabled ? 'enable' : 'disable';
    const response = await request(`${this.baseUrl}/debug/${nodeId}/${action}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    // enable returns 200, disable returns 201
    if (response.statusCode !== 200 && response.statusCode !== 201) {
      const body = await response.body.text();
      throw new Error(`Failed to ${action} debug node: ${response.statusCode}\n${body}`);
    }
  }

  async validateFlow(
    flowData: NodeRedUpdateFlowRequest
  ): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const errors: string[] = [];

      if (!flowData.id) {
        errors.push('Flow missing required id field');
      }

      if ('nodes' in flowData) {
        const nodes = flowData.nodes;
        if (!Array.isArray(nodes)) {
          errors.push('Flow nodes must be an array');
        } else {
          if (flowData.id !== 'global' && nodes.length === 0) {
            // Empty arrays are allowed by Node-RED, but we still want a well-formed array present.
          }

          const seenNodeIds = new Set<string>();
          for (const node of nodes) {
            if (!node.id) {
              errors.push('Node missing required id field');
            }
            if (!node.type) {
              errors.push(`Node ${node.id} missing required type field`);
            }
            validateEmbeddedNodeFields(node, errors);
            if (node.id) {
              if (seenNodeIds.has(node.id)) {
                errors.push(`Duplicate node id found: ${node.id}`);
              }
              seenNodeIds.add(node.id);
            }
          }
        }
      } else if (flowData.id !== 'global') {
        errors.push('Flow missing required nodes array');
      }

      if (flowData.configs) {
        const seenConfigIds = new Set<string>();
        for (const config of flowData.configs) {
          if (!config.id) {
            errors.push('Config node missing required id field');
          }
          if (!config.type) {
            errors.push(`Config node ${config.id} missing required type field`);
          }
          validateEmbeddedNodeFields(config, errors);
          if (config.id) {
            if (seenConfigIds.has(config.id)) {
              errors.push(`Duplicate config node id found: ${config.id}`);
            }
            seenConfigIds.add(config.id);
          }
        }
      }

      if ('subflows' in flowData && Array.isArray(flowData.subflows)) {
        const seenSubflowIds = new Set<string>();
        for (const subflow of flowData.subflows) {
          if (!subflow.id) {
            errors.push('Subflow missing required id field');
          }
          if (!subflow.type) {
            errors.push(`Subflow ${subflow.id} missing required type field`);
          }
          if (subflow.id) {
            if (seenSubflowIds.has(subflow.id)) {
              errors.push(`Duplicate subflow id found: ${subflow.id}`);
            }
            seenSubflowIds.add(subflow.id);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  async getNodes(): Promise<NodeModule[]> {
    const response = await request(`${this.baseUrl}/nodes`, {
      method: 'GET',
      headers: this.getHeaders({ accept: 'application/json' }),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get nodes: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return z.array(NodeModuleSchema).parse(data);
  }

  async getNodesHtml(): Promise<string> {
    const response = await request(`${this.baseUrl}/nodes`, {
      method: 'GET',
      headers: this.getHeaders({ accept: 'text/html' }),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get node help HTML: ${response.statusCode}\n${body}`);
    }

    return await response.body.text();
  }

  async getNodeCatalogue(): Promise<NodeCatalogue> {
    const response = await request(this.catalogueUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to get node catalogue: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return NodeCatalogueSchema.parse(data);
  }

  async installNode(module: string): Promise<NodeModule> {
    const response = await request(`${this.baseUrl}/nodes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ module }),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to install node module: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return NodeModuleSchema.parse(data);
  }

  async setNodeModuleState(module: string, enabled: boolean): Promise<NodeModule> {
    const response = await request(`${this.baseUrl}/nodes/${module}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ enabled }),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Failed to set node module state: ${response.statusCode}\n${body}`);
    }

    const data = await response.body.json();
    return NodeModuleSchema.parse(data);
  }

  async removeNodeModule(module: string): Promise<void> {
    const response = await request(`${this.baseUrl}/nodes/${module}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (response.statusCode !== 204) {
      const body = await response.body.text();
      throw new Error(`Failed to remove node module: ${response.statusCode}\n${body}`);
    }
  }
}

type HeaderOptions = {
  accept?: string;
  apiVersion?: 'v1' | 'v2' | string;
  contentType?: string | false;
  deploymentType?: 'full' | 'nodes' | 'flows' | 'reload';
};

function validateEmbeddedNodeFields(node: Record<string, unknown>, errors: string[]) {
  const nodeLabel = `${typeof node.type === 'string' ? node.type : 'unknown'} node ${typeof node.id === 'string' ? node.id : '<missing-id>'}`;

  validateJsonStringField(node, 'inputSchema', nodeLabel, errors);
  validateJsonStringField(node, 'outputSchema', nodeLabel, errors, { allowEmpty: true });
  validateJsonStringField(node, 'envelopeJson', nodeLabel, errors);
  validateFunctionNode(node, nodeLabel, errors);
}

function validateJsonStringField(
  node: Record<string, unknown>,
  fieldName: string,
  nodeLabel: string,
  errors: string[],
  options: { allowEmpty?: boolean } = {}
) {
  const rawValue = node[fieldName];
  if (typeof rawValue !== 'string') {
    return;
  }

  if (rawValue.trim().length === 0) {
    if (!options.allowEmpty) {
      return;
    }
    return;
  }

  try {
    JSON.parse(rawValue);
  } catch (error) {
    errors.push(
      `${nodeLabel} has invalid JSON in ${fieldName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function validateFunctionNode(node: Record<string, unknown>, nodeLabel: string, errors: string[]) {
  if (node.type !== 'function') {
    return;
  }

  const rawFunction = node.func;
  if (typeof rawFunction !== 'string' || rawFunction.trim().length === 0) {
    return;
  }

  try {
    // Parse-only syntax check for Node-RED function node bodies.
    new Function(rawFunction);
  } catch (error) {
    errors.push(
      `${nodeLabel} has invalid JavaScript in func: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
