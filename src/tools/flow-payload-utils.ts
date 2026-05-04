import type {
  NodeRedConfig,
  NodeRedCreateFlowRequest,
  NodeRedNode,
  NodeRedUpdateFlowRequest,
} from '../schemas.js';

export function normalizeFlowPayload<T extends NodeRedCreateFlowRequest | NodeRedUpdateFlowRequest>(
  flow: T
): T {
  if (!('nodes' in flow) || !Array.isArray(flow.nodes)) {
    return flow;
  }

  const regularNodes: NodeRedNode[] = [];
  const configNodes: NodeRedConfig[] = [...(flow.configs ?? [])];

  for (const node of flow.nodes) {
    if (isConfigNodeCandidate(node)) {
      configNodes.push(node);
      continue;
    }

    regularNodes.push(
      flow.id && flow.id !== 'global' && !node.z
        ? {
            ...node,
            z: flow.id,
          }
        : node
    );
  }

  return {
    ...flow,
    nodes: regularNodes,
    ...(configNodes.length > 0 ? { configs: configNodes } : {}),
  };
}

function isConfigNodeCandidate(node: NodeRedNode) {
  return node.x === undefined && node.y === undefined && node.wires === undefined;
}
