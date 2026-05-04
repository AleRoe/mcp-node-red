import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeRedClient } from '../src/client.js';
import { analyzeFlows } from '../src/tools/analyze-flows.js';
import { createFlow } from '../src/tools/create-flow.js';
import { deleteContext } from '../src/tools/delete-context.js';
import { deleteFlow } from '../src/tools/delete-flow.js';
import { getContext } from '../src/tools/get-context.js';
import { getFlowState } from '../src/tools/get-flow-state.js';
import { getFlows } from '../src/tools/get-flows.js';
import { getNodeCatalog } from '../src/tools/get-node-catalog.js';
import { getNodeHelp } from '../src/tools/get-node-help.js';
import { getNodes } from '../src/tools/get-nodes.js';
import { installNode } from '../src/tools/install-node.js';
import { recommendFlowImplementation } from '../src/tools/recommend-flow-implementation.js';
import { removeNodeModule } from '../src/tools/remove-node-module.js';
import { searchNodeCatalogue } from '../src/tools/search-node-catalogue.js';
import { setDebugState } from '../src/tools/set-debug-state.js';
import { setFlowState } from '../src/tools/set-flow-state.js';
import { setNodeModuleState } from '../src/tools/set-node-module-state.js';
import { triggerInject } from '../src/tools/trigger-inject.js';
import { updateFlow } from '../src/tools/update-flow.js';
import { validateFlow } from '../src/tools/validate-flow.js';

describe('Tool Handlers', () => {
  let mockClient: NodeRedClient;

  beforeEach(() => {
    mockClient = {
      getFlows: vi.fn(),
      createFlow: vi.fn(),
      getContext: vi.fn(),
      deleteContext: vi.fn(),
      updateFlow: vi.fn(),
      deleteFlow: vi.fn(),
      validateFlow: vi.fn(),
      getFlowState: vi.fn(),
      setFlowState: vi.fn(),
      getNodes: vi.fn(),
      installNode: vi.fn(),
      setNodeModuleState: vi.fn(),
      removeNodeModule: vi.fn(),
      triggerInject: vi.fn(),
      setDebugNodeState: vi.fn(),
      getSettings: vi.fn(),
      getNodesHtml: vi.fn(),
      getNodeCatalogue: vi.fn(),
    } as any;
  });

  describe('getFlows', () => {
    it('should return formatted flows', async () => {
      const mockFlowsData = {
        rev: 'abc123',
        flows: [{ id: '1', type: 'tab', label: 'Flow 1' }],
      };

      vi.mocked(mockClient.getFlows).mockResolvedValue(mockFlowsData);

      const result = await getFlows(mockClient);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(mockFlowsData);
    });
  });

  describe('analyzeFlows', () => {
    it('should summarize all flows', async () => {
      vi.mocked(mockClient.getFlows).mockResolvedValue({
        rev: 'rev-1',
        flows: [
          { id: 'flow-1', type: 'tab', label: 'Main Flow' },
          { id: 'inject-1', type: 'inject', z: 'flow-1', wires: [['debug-1']] },
          { id: 'debug-1', type: 'debug', z: 'flow-1', wires: [] },
        ],
      });

      const result = await analyzeFlows(mockClient, {});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.summary.flowCount).toBe(1);
      expect(parsed.flows[0].label).toBe('Main Flow');
      expect(parsed.flows[0].nodeTypeCounts).toEqual([
        { type: 'debug', count: 1 },
        { type: 'inject', count: 1 },
      ]);
    });

    it('should analyze a specific flow', async () => {
      vi.mocked(mockClient.getFlows).mockResolvedValue({
        rev: 'rev-1',
        flows: [
          { id: 'flow-1', type: 'tab', label: 'Main Flow' },
          { id: 'inject-1', type: 'inject', name: 'Start', z: 'flow-1', wires: [['debug-1']] },
          { id: 'debug-1', type: 'debug', z: 'flow-1', wires: [] },
        ],
      });

      const result = await analyzeFlows(mockClient, { flowId: 'flow-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.flow.id).toBe('flow-1');
      expect(parsed.summary.nodeCount).toBe(2);
      expect(parsed.nodes[0].id).toBe('inject-1');
    });

    it('should fail for an unknown flow', async () => {
      vi.mocked(mockClient.getFlows).mockResolvedValue({
        rev: 'rev-1',
        flows: [{ id: 'flow-1', type: 'tab', label: 'Main Flow' }],
      });

      await expect(analyzeFlows(mockClient, { flowId: 'missing' })).rejects.toThrow(
        'Flow not found: missing'
      );
    });
  });

  describe('updateFlow', () => {
    it('should update flow', async () => {
      const mockResponse = { id: '1' };

      vi.mocked(mockClient.updateFlow).mockResolvedValue(mockResponse);

      const result = await updateFlow(mockClient, {
        flowId: '1',
        flow: { label: 'New Label', nodes: [] },
      });

      expect(mockClient.updateFlow).toHaveBeenCalledWith('1', {
        id: '1',
        label: 'New Label',
        nodes: [],
      });
      expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
    });

    it('should reject mismatched flow ids', async () => {
      await expect(
        updateFlow(mockClient, {
          flowId: '1',
          flow: { id: '2', label: 'Mismatch', nodes: [] },
        })
      ).rejects.toThrow('flow.id (2) must match flowId (1)');
    });

    it('should ensure flowId matches id in updates', async () => {
      vi.mocked(mockClient.updateFlow).mockResolvedValue({ id: '1' });

      await updateFlow(mockClient, {
        flowId: '1',
        flow: { label: 'Test', nodes: [] },
      });

      expect(mockClient.updateFlow).toHaveBeenCalledWith('1', expect.objectContaining({ id: '1' }));
    });

    it('should normalize misplaced config nodes before updating', async () => {
      vi.mocked(mockClient.updateFlow).mockResolvedValue({ id: '1' });

      await updateFlow(mockClient, {
        flowId: '1',
        flow: {
          label: 'Test',
          nodes: [
            { id: 'cfg-1', type: 'mcp-endpoint-config', name: 'Server Config' },
            { id: 'node-1', type: 'inject', x: 100, y: 120, wires: [[]] },
          ],
        },
      });

      expect(mockClient.updateFlow).toHaveBeenCalledWith('1', {
        id: '1',
        label: 'Test',
        nodes: [{ id: 'node-1', type: 'inject', x: 100, y: 120, wires: [[]], z: '1' }],
        configs: [{ id: 'cfg-1', type: 'mcp-endpoint-config', name: 'Server Config' }],
      });
    });
  });

  describe('createFlow', () => {
    it('should create flow from a structured flow payload', async () => {
      vi.mocked(mockClient.createFlow).mockResolvedValue({ id: 'flow-1' });

      const result = await createFlow(mockClient, {
        flow: {
          label: 'New Flow',
          nodes: [],
          configs: [],
        },
      });

      expect(mockClient.createFlow).toHaveBeenCalledWith({
        label: 'New Flow',
        nodes: [],
        configs: [],
      });
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 'flow-1' });
    });

    it('should normalize misplaced config nodes before creating', async () => {
      vi.mocked(mockClient.createFlow).mockResolvedValue({ id: 'flow-1' });

      await createFlow(mockClient, {
        flow: {
          id: 'flow-1',
          label: 'New Flow',
          nodes: [
            { id: 'cfg-1', type: 'mcp-endpoint-config', name: 'Server Config' },
            { id: 'node-1', type: 'debug', x: 100, y: 120, wires: [] },
          ],
        },
      });

      expect(mockClient.createFlow).toHaveBeenCalledWith({
        id: 'flow-1',
        label: 'New Flow',
        nodes: [{ id: 'node-1', type: 'debug', x: 100, y: 120, wires: [], z: 'flow-1' }],
        configs: [{ id: 'cfg-1', type: 'mcp-endpoint-config', name: 'Server Config' }],
      });
    });
  });

  describe('deleteFlow', () => {
    it('should delete flow and return confirmation', async () => {
      vi.mocked(mockClient.deleteFlow).mockResolvedValue(undefined);

      const result = await deleteFlow(mockClient, { flowId: 'flow-1' });

      expect(mockClient.deleteFlow).toHaveBeenCalledWith('flow-1');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual({ deleted: 'flow-1' });
    });

    it('should throw error for missing flowId', async () => {
      await expect(deleteFlow(mockClient, {})).rejects.toThrow();
    });

    it('should propagate client errors', async () => {
      vi.mocked(mockClient.deleteFlow).mockRejectedValue(
        new Error('Failed to delete flow: 404\nNot Found')
      );

      await expect(deleteFlow(mockClient, { flowId: 'nonexistent' })).rejects.toThrow(
        'Failed to delete flow: 404'
      );
    });
  });

  describe('validateFlow', () => {
    it('should validate valid flow', async () => {
      vi.mocked(mockClient.validateFlow).mockResolvedValue({
        valid: true,
      });

      const result = await validateFlow(mockClient, {
        flow: { id: '1', label: 'Test', nodes: [] },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
      expect(parsed.errors).toBeUndefined();
    });

    it('should return validation errors', async () => {
      vi.mocked(mockClient.validateFlow).mockResolvedValue({
        valid: false,
        errors: ['Missing required field'],
      });

      const result = await validateFlow(mockClient, {
        flow: { id: '1', nodes: [] },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(false);
      expect(parsed.errors).toEqual(['Missing required field']);
    });

    it('should reject unsupported flow payloads before reaching the client', async () => {
      await expect(
        validateFlow(mockClient, {
          flow: { id: '1' },
        })
      ).rejects.toThrow();
    });
  });

  describe('getFlowState', () => {
    it('should return flow state', async () => {
      vi.mocked(mockClient.getFlowState).mockResolvedValue({ state: 'start' });

      const result = await getFlowState(mockClient);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.state).toBe('start');
    });

    it('should return stopped state', async () => {
      vi.mocked(mockClient.getFlowState).mockResolvedValue({ state: 'stop' });

      const result = await getFlowState(mockClient);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.state).toBe('stop');
    });
  });

  describe('setFlowState', () => {
    it('should set state to stop', async () => {
      vi.mocked(mockClient.setFlowState).mockResolvedValue({ state: 'stop' });

      const result = await setFlowState(mockClient, { state: 'stop' });

      expect(mockClient.setFlowState).toHaveBeenCalledWith('stop');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.state).toBe('stop');
    });

    it('should set state to start', async () => {
      vi.mocked(mockClient.setFlowState).mockResolvedValue({ state: 'start' });

      const result = await setFlowState(mockClient, { state: 'start' });

      expect(mockClient.setFlowState).toHaveBeenCalledWith('start');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.state).toBe('start');
    });

    it('should throw error for invalid state', async () => {
      await expect(setFlowState(mockClient, { state: 'invalid' })).rejects.toThrow();
    });

    it('should throw error when state is missing', async () => {
      await expect(setFlowState(mockClient, {})).rejects.toThrow();
    });
  });

  describe('getNodes', () => {
    it('should return formatted node modules', async () => {
      const mockModules = [
        {
          name: 'node-red-contrib-example',
          version: '1.0.0',
          nodes: {
            example: {
              id: 'node-red-contrib-example/example',
              name: 'example',
              types: ['example-node'],
              enabled: true,
              module: 'node-red-contrib-example',
            },
          },
        },
      ];

      vi.mocked(mockClient.getNodes).mockResolvedValue(mockModules);

      const result = await getNodes(mockClient);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(mockModules);
    });

    it('should handle empty modules list', async () => {
      vi.mocked(mockClient.getNodes).mockResolvedValue([]);

      const result = await getNodes(mockClient);

      expect(JSON.parse(result.content[0].text)).toEqual([]);
    });
  });

  describe('getNodeCatalog', () => {
    it('should enrich installed nodes with flow usage', async () => {
      vi.mocked(mockClient.getNodes).mockResolvedValue([
        {
          name: 'node-red',
          version: '4.0.0',
          nodes: {
            core: {
              id: 'node-red/core',
              name: 'core',
              types: ['inject', 'debug'],
              enabled: true,
              module: 'node-red',
            },
          },
        },
      ]);
      vi.mocked(mockClient.getFlows).mockResolvedValue({
        rev: 'rev-1',
        flows: [
          { id: 'flow-1', type: 'tab', label: 'Main Flow' },
          { id: 'inject-1', type: 'inject', z: 'flow-1', wires: [['debug-1']] },
          { id: 'debug-1', type: 'debug', z: 'flow-1', wires: [] },
        ],
      });

      const result = await getNodeCatalog(mockClient, {});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.installedModules).toBe(1);
      expect(parsed.nodeSets[0].usage).toEqual([
        { type: 'inject', usedCount: 1, usedInFlows: ['Main Flow'] },
        { type: 'debug', usedCount: 1, usedInFlows: ['Main Flow'] },
      ]);
    });
  });

  describe('getNodeHelp', () => {
    it('should return compact help by default for a node type', async () => {
      vi.mocked(mockClient.getNodesHtml).mockResolvedValue(`
        <script type="text/html" data-template-name="inject">
          <div class="form-row">
            <label for="node-input-name">Name <i class="fa fa-question-circle" data-tooltip="Optional label shown in the editor."></i></label>
            <input type="text" id="node-input-name" placeholder="optional" />
          </div>
          <div class="form-row">
            <label for="node-input-topic">Topic</label>
            <input type="text" id="node-input-topic" />
          </div>
        </script>
        <script type="text/html" data-help-name="inject">
          <p>Injects a message into a flow.</p>
          <h3>Details</h3>
          <p>Use this node to start a flow manually or on a schedule.</p>
          <h3>Outputs</h3>
          <dl class="message-properties">
            <dt>payload <span class="property-type">any</span></dt>
            <dd>The value to send.</dd>
          </dl>
        </script>
      `);

      const result = await getNodeHelp(mockClient, { type: 'inject' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.type).toBe('inject');
      expect(parsed.summary).toContain('Use this node to start a flow manually or on a schedule.');
      expect(parsed.keyArguments).toEqual([
        {
          name: 'name',
          label: 'Name',
          description: 'Optional label shown in the editor.',
          inputType: 'text',
          placeholder: 'optional',
          required: false,
        },
        {
          name: 'topic',
          label: 'Topic',
          description: '',
          inputType: 'text',
          placeholder: '',
          required: false,
        },
      ]);
      expect(parsed.sectionTitles).toEqual(['Details', 'Outputs']);
      expect(parsed.helpHtml).toBeUndefined();
    });

    it('should return full help when requested', async () => {
      vi.mocked(mockClient.getNodesHtml).mockResolvedValue(`
        <script type="text/html" data-template-name="inject">
          <div class="form-row">
            <label for="node-input-name">Name</label>
            <input type="text" id="node-input-name" />
          </div>
        </script>
        <script type="text/html" data-help-name="inject">
          <p>Injects a message into a flow.</p>
          <h3>Details</h3>
          <p>Use this node to start a flow manually or on a schedule.</p>
          <h3>Outputs</h3>
          <dl class="message-properties">
            <dt>payload <span class="property-type">any</span></dt>
            <dd>The value to send.</dd>
          </dl>
        </script>
      `);

      const result = await getNodeHelp(mockClient, {
        type: 'inject',
        detail: 'full',
        includeHtml: true,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.helpText).toContain('Injects a message into a flow.');
      expect(parsed.helpHtml).toContain('<p>Injects a message into a flow.</p>');
      expect(parsed.sections[1].properties).toEqual([
        {
          name: 'payload',
          type: 'any',
          description: 'The value to send.',
          optional: false,
        },
      ]);
    });

    it('should return a catalog when no type is provided', async () => {
      vi.mocked(mockClient.getNodesHtml).mockResolvedValue(`
        <script type="text/html" data-template-name="inject"></script>
        <script type="text/html" data-help-name="inject"><h3>Details</h3><p>Inject help.</p></script>
        <script type="text/html" data-help-name="debug"><h3>Details</h3><p>Debug help.</p></script>
      `);

      const result = await getNodeHelp(mockClient, {});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.totalNodeTypes).toBe(2);
      expect(parsed.returnedNodeTypes).toBe(2);
      expect(parsed.truncated).toBe(false);
      expect(parsed.summary.nodesWithHelp).toBe(2);
      expect(parsed.suggestedStartingPoints.length).toBeGreaterThan(0);
      expect(parsed.nodeTypes).toEqual([
        {
          type: 'debug',
          family: 'core',
          summary: 'Debug help.',
          isConfigNode: false,
          hasHelp: true,
          argumentCount: 0,
          keyArguments: [],
          sectionTitles: ['Details'],
        },
        {
          type: 'inject',
          family: 'core',
          summary: 'Inject help.',
          isConfigNode: false,
          hasHelp: true,
          argumentCount: 0,
          keyArguments: [],
          sectionTitles: ['Details'],
        },
      ]);
    });

    it('should truncate oversized full node help payloads', async () => {
      const largeParagraph = 'A'.repeat(5000);
      vi.mocked(mockClient.getNodesHtml).mockResolvedValue(`
        <script type="text/html" data-help-name="big-node">
          <p>${largeParagraph}</p>
          <h3>Details</h3>
          <p>${largeParagraph}</p>
        </script>
      `);

      const result = await getNodeHelp(mockClient, {
        type: 'big-node',
        detail: 'full',
        maxChars: 1500,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.truncated).toBe(true);
      expect(result.content[0].text.length).toBeLessThanOrEqual(2000);
    });

    it('should limit catalog responses by default limit parameter', async () => {
      vi.mocked(mockClient.getNodesHtml).mockResolvedValue(`
        <script type="text/html" data-help-name="alpha"><h3>Details</h3><p>Alpha help.</p></script>
        <script type="text/html" data-help-name="beta"><h3>Details</h3><p>Beta help.</p></script>
        <script type="text/html" data-help-name="gamma"><h3>Details</h3><p>Gamma help.</p></script>
      `);

      const result = await getNodeHelp(mockClient, { limit: 2 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.totalNodeTypes).toBe(3);
      expect(parsed.returnedNodeTypes).toBe(2);
      expect(parsed.truncated).toBe(true);
      expect(parsed.nodeTypes).toHaveLength(2);
    });
  });

  describe('recommendFlowImplementation', () => {
    it('should provide guided recommendations from live context', async () => {
      vi.mocked(mockClient.getNodes).mockResolvedValue([
        {
          name: 'node-red',
          version: '4.0.0',
          nodes: {
            core: {
              id: 'node-red/core',
              name: 'core',
              types: ['http in', 'http response', 'debug'],
              enabled: true,
              module: 'node-red',
            },
          },
        },
      ]);
      vi.mocked(mockClient.getFlows).mockResolvedValue({
        rev: 'rev-1',
        flows: [{ id: 'flow-1', type: 'tab', label: 'HTTP Flow' }],
      });

      const result = await recommendFlowImplementation(mockClient, {
        goal: 'Build an HTTP webhook that transforms JSON',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.recommendedNodes).toContain('http in');
      expect(parsed.recommendedNodes).toContain('http response');
      expect(parsed.patterns.length).toBeGreaterThan(0);
      expect(parsed.bestPractices.length).toBeGreaterThan(0);
    });
  });

  describe('searchNodeCatalogue', () => {
    it('should search the public catalogue by text and node type', async () => {
      vi.mocked(mockClient.getNodeCatalogue).mockResolvedValue({
        name: 'Node-RED Community catalogue',
        updated_at: '2026-04-28T00:00:00.000Z',
        modules: [
          {
            id: 'node-red-contrib-mqtt-extra',
            version: '1.0.0',
            description: 'MQTT helper nodes',
            updated_at: '2026-04-27T00:00:00.000Z',
            types: ['mqtt in', 'mqtt out'],
            keywords: ['node-red', 'mqtt'],
            url: 'https://flows.nodered.org/node/node-red-contrib-mqtt-extra',
          },
          {
            id: 'node-red-contrib-sql-helper',
            version: '1.0.0',
            description: 'Database helper nodes',
            updated_at: '2026-04-27T00:00:00.000Z',
            types: ['sql-query'],
            keywords: ['node-red', 'database'],
            url: 'https://flows.nodered.org/node/node-red-contrib-sql-helper',
          },
        ],
      });

      const result = await searchNodeCatalogue(mockClient, {
        text: 'mqtt',
        nodeType: 'mqtt in',
        limit: 5,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.returnedResults).toBe(1);
      expect(parsed.results[0].id).toBe('node-red-contrib-mqtt-extra');
      expect(parsed.results[0].types).toContain('mqtt in');
    });

    it('should support exact module filtering', async () => {
      vi.mocked(mockClient.getNodeCatalogue).mockResolvedValue({
        modules: [
          {
            id: 'node-red-contrib-example',
            version: '1.2.3',
            description: 'Example nodes',
            types: ['example-node'],
            keywords: ['example'],
            url: 'https://flows.nodered.org/node/node-red-contrib-example',
          },
        ],
      });

      const result = await searchNodeCatalogue(mockClient, { module: 'node-red-contrib-example' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.returnedResults).toBe(1);
      expect(parsed.results[0].id).toBe('node-red-contrib-example');
    });
  });

  describe('installNode', () => {
    it('should install node module', async () => {
      const mockModule = {
        name: 'node-red-contrib-example',
        version: '1.0.0',
        nodes: {},
      };

      vi.mocked(mockClient.installNode).mockResolvedValue(mockModule);

      const result = await installNode(mockClient, { module: 'node-red-contrib-example' });

      expect(mockClient.installNode).toHaveBeenCalledWith('node-red-contrib-example');
      expect(JSON.parse(result.content[0].text)).toEqual(mockModule);
    });

    it('should throw on missing module argument', async () => {
      await expect(installNode(mockClient, {})).rejects.toThrow();
    });
  });

  describe('setNodeModuleState', () => {
    it('should enable a module', async () => {
      const mockModule = {
        name: 'node-red-contrib-example',
        version: '1.0.0',
        nodes: {},
      };

      vi.mocked(mockClient.setNodeModuleState).mockResolvedValue(mockModule);

      const result = await setNodeModuleState(mockClient, {
        module: 'node-red-contrib-example',
        enabled: true,
      });

      expect(mockClient.setNodeModuleState).toHaveBeenCalledWith('node-red-contrib-example', true);
      expect(JSON.parse(result.content[0].text)).toEqual(mockModule);
    });

    it('should disable a module', async () => {
      const mockModule = {
        name: 'node-red-contrib-example',
        version: '1.0.0',
        nodes: {},
      };

      vi.mocked(mockClient.setNodeModuleState).mockResolvedValue(mockModule);

      const result = await setNodeModuleState(mockClient, {
        module: 'node-red-contrib-example',
        enabled: false,
      });

      expect(mockClient.setNodeModuleState).toHaveBeenCalledWith('node-red-contrib-example', false);
      expect(JSON.parse(result.content[0].text)).toEqual(mockModule);
    });

    it('should throw on missing module argument', async () => {
      await expect(setNodeModuleState(mockClient, { enabled: true })).rejects.toThrow();
    });

    it('should throw on missing enabled argument', async () => {
      await expect(
        setNodeModuleState(mockClient, { module: 'node-red-contrib-example' })
      ).rejects.toThrow();
    });
  });

  describe('getContext', () => {
    it('should get global context', async () => {
      const mockData = { key1: 'value1' };
      vi.mocked(mockClient.getContext).mockResolvedValue(mockData);
      const result = await getContext(mockClient, { scope: 'global' });
      expect(mockClient.getContext).toHaveBeenCalledWith('global', undefined, undefined, undefined);
      expect(JSON.parse(result.content[0].text)).toEqual(mockData);
    });

    it('should get global context with key', async () => {
      vi.mocked(mockClient.getContext).mockResolvedValue({ value: 'test' });
      await getContext(mockClient, { scope: 'global', key: 'myKey' });
      expect(mockClient.getContext).toHaveBeenCalledWith('global', undefined, 'myKey', undefined);
    });

    it('should get flow context with id', async () => {
      vi.mocked(mockClient.getContext).mockResolvedValue({});
      await getContext(mockClient, { scope: 'flow', id: 'flow-1' });
      expect(mockClient.getContext).toHaveBeenCalledWith('flow', 'flow-1', undefined, undefined);
    });

    it('should get node context with id and key', async () => {
      vi.mocked(mockClient.getContext).mockResolvedValue({ count: 5 });
      await getContext(mockClient, { scope: 'node', id: 'node-1', key: 'count' });
      expect(mockClient.getContext).toHaveBeenCalledWith('node', 'node-1', 'count', undefined);
    });

    it('should pass store parameter', async () => {
      vi.mocked(mockClient.getContext).mockResolvedValue({});
      await getContext(mockClient, { scope: 'global', key: 'myKey', store: 'file' });
      expect(mockClient.getContext).toHaveBeenCalledWith('global', undefined, 'myKey', 'file');
    });

    it('should throw error when flow scope missing id', async () => {
      await expect(getContext(mockClient, { scope: 'flow' })).rejects.toThrow(
        'id is required when scope is "flow"'
      );
    });

    it('should throw error when node scope missing id', async () => {
      await expect(getContext(mockClient, { scope: 'node' })).rejects.toThrow(
        'id is required when scope is "node"'
      );
    });

    it('should throw error for invalid scope', async () => {
      await expect(getContext(mockClient, { scope: 'invalid' })).rejects.toThrow();
    });
  });

  describe('deleteContext', () => {
    it('should delete global context key', async () => {
      vi.mocked(mockClient.deleteContext).mockResolvedValue(undefined);
      const result = await deleteContext(mockClient, { scope: 'global', key: 'myKey' });
      expect(mockClient.deleteContext).toHaveBeenCalledWith(
        'global',
        undefined,
        'myKey',
        undefined
      );
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('myKey');
    });

    it('should delete flow context key', async () => {
      vi.mocked(mockClient.deleteContext).mockResolvedValue(undefined);
      await deleteContext(mockClient, { scope: 'flow', id: 'flow-1', key: 'counter' });
      expect(mockClient.deleteContext).toHaveBeenCalledWith('flow', 'flow-1', 'counter', undefined);
    });

    it('should delete node context key', async () => {
      vi.mocked(mockClient.deleteContext).mockResolvedValue(undefined);
      await deleteContext(mockClient, { scope: 'node', id: 'node-1', key: 'data' });
      expect(mockClient.deleteContext).toHaveBeenCalledWith('node', 'node-1', 'data', undefined);
    });

    it('should pass store parameter on delete', async () => {
      vi.mocked(mockClient.deleteContext).mockResolvedValue(undefined);
      await deleteContext(mockClient, { scope: 'global', key: 'myKey', store: 'file' });
      expect(mockClient.deleteContext).toHaveBeenCalledWith('global', undefined, 'myKey', 'file');
    });

    it('should throw error when flow scope missing id', async () => {
      await expect(deleteContext(mockClient, { scope: 'flow', key: 'counter' })).rejects.toThrow(
        'id is required when scope is "flow"'
      );
    });

    it('should throw error when node scope missing id', async () => {
      await expect(deleteContext(mockClient, { scope: 'node', key: 'data' })).rejects.toThrow(
        'id is required when scope is "node"'
      );
    });

    it('should throw error when key is missing', async () => {
      await expect(deleteContext(mockClient, { scope: 'global' })).rejects.toThrow();
    });
  });

  describe('removeNodeModule', () => {
    it('should remove node module', async () => {
      vi.mocked(mockClient.removeNodeModule).mockResolvedValue(undefined);

      const result = await removeNodeModule(mockClient, { module: 'node-red-contrib-example' });

      expect(mockClient.removeNodeModule).toHaveBeenCalledWith('node-red-contrib-example');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.module).toBe('node-red-contrib-example');
    });

    it('should throw on missing module argument', async () => {
      await expect(removeNodeModule(mockClient, {})).rejects.toThrow();
    });
  });

  describe('triggerInject', () => {
    it('should trigger inject node and return confirmation', async () => {
      vi.mocked(mockClient.triggerInject).mockResolvedValue(undefined);

      const result = await triggerInject(mockClient, { nodeId: 'inject-1' });

      expect(mockClient.triggerInject).toHaveBeenCalledWith('inject-1');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ nodeId: 'inject-1', triggered: true });
    });

    it('should throw on missing nodeId', async () => {
      await expect(triggerInject(mockClient, {})).rejects.toThrow();
    });

    it('should propagate client errors', async () => {
      vi.mocked(mockClient.triggerInject).mockRejectedValue(
        new Error('Failed to trigger inject node: 404\nNot Found')
      );

      await expect(triggerInject(mockClient, { nodeId: 'nonexistent' })).rejects.toThrow(
        'Failed to trigger inject node: 404'
      );
    });
  });

  describe('setDebugState', () => {
    it('should enable debug node and return confirmation', async () => {
      vi.mocked(mockClient.setDebugNodeState).mockResolvedValue(undefined);

      const result = await setDebugState(mockClient, { nodeId: 'debug-1', enabled: true });

      expect(mockClient.setDebugNodeState).toHaveBeenCalledWith('debug-1', true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ nodeId: 'debug-1', enabled: true });
    });

    it('should disable debug node', async () => {
      vi.mocked(mockClient.setDebugNodeState).mockResolvedValue(undefined);

      const result = await setDebugState(mockClient, { nodeId: 'debug-1', enabled: false });

      expect(mockClient.setDebugNodeState).toHaveBeenCalledWith('debug-1', false);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ nodeId: 'debug-1', enabled: false });
    });

    it('should throw on missing nodeId', async () => {
      await expect(setDebugState(mockClient, { enabled: true })).rejects.toThrow();
    });

    it('should throw on missing enabled', async () => {
      await expect(setDebugState(mockClient, { nodeId: 'debug-1' })).rejects.toThrow();
    });

    it('should propagate client errors', async () => {
      vi.mocked(mockClient.setDebugNodeState).mockRejectedValue(
        new Error('Failed to enable debug node: 404\nNot Found')
      );

      await expect(
        setDebugState(mockClient, { nodeId: 'nonexistent', enabled: true })
      ).rejects.toThrow('Failed to enable debug node: 404');
    });
  });
});
