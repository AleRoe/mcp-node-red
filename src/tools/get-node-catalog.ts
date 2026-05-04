import type { NodeRedClient } from '../client.js';
import { GetNodeCatalogArgsSchema } from '../schemas.js';
import { countByType, flattenInstalledNodeSets, summarizeFlows } from './context-utils.js';

export async function getNodeCatalog(client: NodeRedClient, args: unknown) {
  const parsed = GetNodeCatalogArgsSchema.parse(args ?? {});
  const [modules, flowsResponse] = await Promise.all([client.getNodes(), client.getFlows()]);
  const flowAnalysis = summarizeFlows(flowsResponse);
  const usageCounts = countByType(flowAnalysis.flatMap((flow) => flow.nodes));

  const usageMap = new Map(usageCounts.map((item) => [item.type, item.count]));
  const flowUsageMap = new Map<string, Set<string>>();
  for (const flow of flowAnalysis) {
    for (const node of flow.nodes) {
      const usedInFlows = flowUsageMap.get(node.type) ?? new Set<string>();
      usedInFlows.add(flow.flow.label);
      flowUsageMap.set(node.type, usedInFlows);
    }
  }

  const installedNodeSets = flattenInstalledNodeSets(modules)
    .filter((item) => !parsed.module || item.module === parsed.module)
    .filter((item) => !parsed.type || item.types.includes(parsed.type))
    .map((item) => ({
      ...item,
      usage: item.types.map((type) => ({
        type,
        usedCount: usageMap.get(type) ?? 0,
        usedInFlows: Array.from(flowUsageMap.get(type) ?? []),
      })),
    }));

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            installedModules: modules.length,
            activeFlows: flowAnalysis.length,
            activeNodeTypes: usageCounts,
            nodeSets: installedNodeSets,
          },
          null,
          2
        ),
      },
    ],
  };
}
