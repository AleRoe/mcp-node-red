import type { NodeRedClient } from '../client.js';
import { RecommendFlowImplementationArgsSchema } from '../schemas.js';
import {
  buildBestPractices,
  findFlowById,
  inferImplementationPatterns,
  suggestInstalledModules,
  summarizeFlows,
} from './context-utils.js';

export async function recommendFlowImplementation(client: NodeRedClient, args: unknown) {
  const parsed = RecommendFlowImplementationArgsSchema.parse(args);
  const [modules, flowsResponse] = await Promise.all([client.getNodes(), client.getFlows()]);
  const patterns = inferImplementationPatterns(
    `${parsed.goal}\n${parsed.constraints ?? ''}`.trim()
  );
  const flowAnalysis = summarizeFlows(flowsResponse);
  const matchingFlow = parsed.existingFlowId
    ? findFlowById(flowsResponse, parsed.existingFlowId)
    : undefined;

  const suggestedModules = suggestInstalledModules(parsed.goal, modules);
  const recommendedNodes = Array.from(
    new Set(
      patterns
        .flatMap((pattern) => pattern.nodes)
        .concat(suggestedModules.flatMap((item) => item.types))
    )
  );

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            goal: parsed.goal,
            constraints: parsed.constraints ?? '',
            basedOn: {
              installedModuleCount: modules.length,
              activeFlowCount: flowAnalysis.length,
              existingFlow: matchingFlow
                ? {
                    id: matchingFlow.flow.id,
                    label: matchingFlow.flow.label,
                    nodeTypeCounts: matchingFlow.nodeTypeCounts,
                  }
                : null,
            },
            recommendedNodes,
            suggestedInstalledModules: suggestedModules,
            patterns: patterns.map((pattern) => ({
              topic: pattern.topic,
              nodes: pattern.nodes,
              guidance: pattern.guidance,
            })),
            implementationSteps: [
              'Start with the trigger/input node and confirm the first `msg.payload` shape with a debug node.',
              'Add transformation and routing nodes next, keeping each branch focused on one concern.',
              'Introduce external integrations or side effects only after the core happy-path message shape is stable.',
              'Name the tab and key nodes clearly, then validate behavior with inject/debug or the appropriate runtime trigger.',
            ],
            bestPractices: buildBestPractices(),
          },
          null,
          2
        ),
      },
    ],
  };
}
