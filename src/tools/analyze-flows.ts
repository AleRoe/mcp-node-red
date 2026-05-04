import type { NodeRedClient } from '../client.js';
import { AnalyzeFlowsArgsSchema } from '../schemas.js';
import { findFlowById, summarizeFlows } from './context-utils.js';

export async function analyzeFlows(client: NodeRedClient, args: unknown) {
  const parsed = AnalyzeFlowsArgsSchema.parse(args ?? {});
  const flowsResponse = await client.getFlows();
  const analysis = summarizeFlows(flowsResponse);

  if (parsed.flowId) {
    const flow = findFlowById(flowsResponse, parsed.flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${parsed.flowId}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              revision: flowsResponse.rev,
              flow: {
                id: flow.flow.id,
                label: flow.flow.label,
                disabled: flow.flow.disabled ?? false,
                info: flow.flow.info ?? '',
              },
              summary: {
                nodeCount: flow.nodes.length,
                configNodeCount: flow.configNodes.length,
                nodeTypeCounts: flow.nodeTypeCounts,
                entryNodeIds: flow.entryNodeIds,
                terminalNodeIds: flow.terminalNodeIds,
                disconnectedNodeIds: flow.disconnectedNodeIds,
              },
              nodes: flow.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                name: node.name ?? '',
                z: node.z,
                wireCount: node.wires?.reduce((count, group) => count + group.length, 0) ?? 0,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            revision: flowsResponse.rev,
            summary: {
              flowCount: analysis.length,
              totalNodeCount: analysis.reduce((count, flow) => count + flow.nodes.length, 0),
              topNodeTypes: analysis
                .flatMap((flow) => flow.nodeTypeCounts)
                .reduce<Record<string, number>>((accumulator, item) => {
                  accumulator[item.type] = (accumulator[item.type] ?? 0) + item.count;
                  return accumulator;
                }, {}),
            },
            flows: analysis.map((flow) => ({
              id: flow.flow.id,
              label: flow.flow.label,
              disabled: flow.flow.disabled ?? false,
              nodeCount: flow.nodes.length,
              configNodeCount: flow.configNodes.length,
              nodeTypeCounts: flow.nodeTypeCounts,
              entryNodeIds: flow.entryNodeIds,
              terminalNodeIds: flow.terminalNodeIds,
              disconnectedNodeIds: flow.disconnectedNodeIds,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
