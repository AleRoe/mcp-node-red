import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NodeRedClient } from './client.js';
import {
  AnalyzeFlowsArgsSchema,
  ConfigSchema,
  CreateFlowToolArgsSchema,
  DeleteContextArgsSchema,
  DeleteFlowArgsSchema,
  GetContextArgsSchema,
  GetNodeCatalogArgsSchema,
  GetNodeHelpArgsSchema,
  InstallNodeArgsSchema,
  RecommendFlowImplementationArgsSchema,
  RemoveNodeModuleArgsSchema,
  SearchNodeCatalogueArgsSchema,
  SetDebugStateArgsSchema,
  SetFlowStateArgsSchema,
  SetNodeModuleStateArgsSchema,
  TriggerInjectArgsSchema,
  UpdateFlowToolArgsSchema,
  ValidateFlowToolArgsSchema,
} from './schemas.js';
import { analyzeFlows } from './tools/analyze-flows.js';
import { createFlow } from './tools/create-flow.js';
import { deleteContext } from './tools/delete-context.js';
import { deleteFlow } from './tools/delete-flow.js';
import { getContext } from './tools/get-context.js';
import { getDiagnostics } from './tools/get-diagnostics.js';
import { getFlowState } from './tools/get-flow-state.js';
import { getFlows } from './tools/get-flows.js';
import { getNodeCatalog } from './tools/get-node-catalog.js';
import { getNodeHelp } from './tools/get-node-help.js';
import { getNodes } from './tools/get-nodes.js';
import { getSettings } from './tools/get-settings.js';
import { installNode } from './tools/install-node.js';
import { recommendFlowImplementation } from './tools/recommend-flow-implementation.js';
import { removeNodeModule } from './tools/remove-node-module.js';
import { searchNodeCatalogue } from './tools/search-node-catalogue.js';
import { setDebugState } from './tools/set-debug-state.js';
import { setFlowState } from './tools/set-flow-state.js';
import { setNodeModuleState } from './tools/set-node-module-state.js';
import { triggerInject } from './tools/trigger-inject.js';
import { updateFlow } from './tools/update-flow.js';
import { validateFlow } from './tools/validate-flow.js';

export function createServer() {
  const nodeRedUrl = process.env.NODE_RED_URL;
  const nodeRedToken = process.env.NODE_RED_TOKEN;

  if (!nodeRedUrl) {
    throw new Error('NODE_RED_URL environment variable is required');
  }

  const config = ConfigSchema.parse({
    nodeRedUrl,
    nodeRedToken,
    nodeRedCatalogueUrl: process.env.NODE_RED_CATALOGUE_URL,
  });

  const client = new NodeRedClient(config);

  const server = new McpServer(
    {
      name: 'node-red-mcp-server',
      version: '1.1.0',
    },
    {
      capabilities: {
        prompts: {},
        tools: {},
      },
    }
  );

  server.registerTool(
    'get_flows',
    {
      description:
        'Get all flows from Node-RED instance. Returns current flows configuration including revision number.',
    },
    async () => getFlows(client)
  );

  server.registerTool(
    'analyze_flows',
    {
      description:
        'Summarize Node-RED flow topology for an AI client. Returns per-flow node counts, node types, entry points, terminal nodes, and disconnected nodes. Optionally scope to one flow by ID.',
      inputSchema: AnalyzeFlowsArgsSchema.shape,
    },
    async (args) => analyzeFlows(client, args)
  );

  server.registerTool(
    'create_flow',
    {
      description:
        'Create a new flow tab using POST /flow. This is the single-flow endpoint, not POST /flows bulk deployment. Send a single-flow payload with regular runtime nodes in flow.nodes and config nodes in flow.configs. Regular nodes should belong to the target flow, typically with z equal to the flow id. Flow ID is optional because Node-RED may assign one.',
      inputSchema: CreateFlowToolArgsSchema.shape,
    },
    async (args) => createFlow(client, args)
  );

  server.registerTool(
    'update_flow',
    {
      description:
        'Update a specific flow by ID using PUT /flow/:id. Send a single-flow payload, not the flat /flows export format. Put regular runtime nodes in flow.nodes, put config nodes in flow.configs, and keep regular node z values aligned to the target flow id. flow.id may be omitted, but if provided it must match flowId. For existing tabs, prefer reading the current flow first and editing that structure rather than rebuilding it from scratch.',
      inputSchema: UpdateFlowToolArgsSchema.shape,
    },
    async (args) => updateFlow(client, args)
  );

  server.registerTool(
    'validate_flow',
    {
      description:
        'Validate a structured single-flow configuration without deploying. Checks required fields and basic structural integrity, including the distinction between regular nodes in flow.nodes and config nodes in flow.configs, against the Node-RED flow shapes this server supports.',
      inputSchema: ValidateFlowToolArgsSchema.shape,
    },
    async (args) => validateFlow(client, args)
  );

  server.registerTool(
    'delete_flow',
    {
      description: 'Delete a flow from Node-RED by ID. Removes the flow and all its nodes.',
      inputSchema: DeleteFlowArgsSchema.shape,
    },
    async (args) => deleteFlow(client, args)
  );

  server.registerTool(
    'get_flow_state',
    {
      description:
        'Get the runtime state of Node-RED flows. Returns whether flows are currently started or stopped. Requires runtimeState to be enabled in Node-RED settings.',
    },
    async () => getFlowState(client)
  );

  server.registerTool(
    'set_flow_state',
    {
      description:
        'Set the runtime state of Node-RED flows to start or stop them. Requires runtimeState to be enabled in Node-RED settings.',
      inputSchema: SetFlowStateArgsSchema.shape,
    },
    async (args) => setFlowState(client, args)
  );

  server.registerTool(
    'get_context',
    {
      description:
        'Read context store data at global, flow, or node scope. Omit key to list all keys.',
      inputSchema: GetContextArgsSchema.shape,
    },
    async (args) => getContext(client, args)
  );

  server.registerTool(
    'delete_context',
    {
      description: 'Delete a context store value at global, flow, or node scope.',
      inputSchema: DeleteContextArgsSchema.shape,
    },
    async (args) => deleteContext(client, args)
  );

  server.registerTool(
    'get_nodes',
    {
      description:
        'Get all installed node modules from Node-RED. Returns array of node module objects with their node sets.',
    },
    async () => getNodes(client)
  );

  server.registerTool(
    'get_node_catalog',
    {
      description:
        'Get installed Node-RED node sets enriched with live usage context from active flows. Useful for understanding which node types are available and where they are already used.',
      inputSchema: GetNodeCatalogArgsSchema.shape,
    },
    async (args) => getNodeCatalog(client, args)
  );

  server.registerTool(
    'get_node_help',
    {
      description:
        'Get Node-RED node help text and editor argument descriptions parsed from the runtime node HTML. Defaults to a compact summary to avoid oversized responses; optionally scope to a specific node type or request fuller detail.',
      inputSchema: GetNodeHelpArgsSchema.shape,
    },
    async (args) => getNodeHelp(client, args)
  );

  server.registerTool(
    'search_node_catalogue',
    {
      description:
        'Search the public Node-RED community node catalogue for installable modules by free text, module name, node type, or keyword.',
      inputSchema: SearchNodeCatalogueArgsSchema.shape,
    },
    async (args) => searchNodeCatalogue(client, args)
  );

  server.registerTool(
    'install_node',
    {
      description: 'Install a new node module into Node-RED. Installs from the npm registry.',
      inputSchema: InstallNodeArgsSchema.shape,
    },
    async (args) => installNode(client, args)
  );

  server.registerTool(
    'set_node_module_state',
    {
      description:
        'Enable or disable a node module in Node-RED. When disabled, the module nodes are unavailable.',
      inputSchema: SetNodeModuleStateArgsSchema.shape,
    },
    async (args) => setNodeModuleState(client, args)
  );

  server.registerTool(
    'remove_node_module',
    {
      description: 'Remove an installed node module from Node-RED. Cannot remove core modules.',
      inputSchema: RemoveNodeModuleArgsSchema.shape,
    },
    async (args) => removeNodeModule(client, args)
  );

  server.registerTool(
    'get_settings',
    {
      description:
        'Get the runtime settings of the Node-RED instance. Returns server configuration including version, httpNodeRoot, and user info.',
    },
    async () => getSettings(client)
  );

  server.registerTool(
    'get_diagnostics',
    {
      description:
        'Get diagnostic information about the Node-RED runtime. Returns system info including Node.js version, OS details, and memory usage.',
    },
    async () => getDiagnostics(client)
  );

  server.registerTool(
    'trigger_inject',
    {
      description:
        'Trigger an inject node to fire with its configured values. The node must be a deployed inject node.',
      inputSchema: TriggerInjectArgsSchema.shape,
    },
    async (args) => triggerInject(client, args)
  );

  server.registerTool(
    'set_debug_state',
    {
      description:
        'Enable or disable a debug node. When disabled, the debug node will not produce output.',
      inputSchema: SetDebugStateArgsSchema.shape,
    },
    async (args) => setDebugState(client, args)
  );

  server.registerTool(
    'recommend_flow_implementation',
    {
      description:
        'Provide Node-RED implementation guidance for a requested task using live knowledge of installed modules and active flows. Returns suggested nodes, implementation patterns, and best practices, including strict flow-authoring rules to follow before create_flow or update_flow.',
      inputSchema: RecommendFlowImplementationArgsSchema.shape,
    },
    async (args) => recommendFlowImplementation(client, args)
  );

  return server;
}
