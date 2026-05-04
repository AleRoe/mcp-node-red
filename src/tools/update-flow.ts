import type { NodeRedClient } from '../client.js';
import { NodeRedUpdateFlowRequestSchema, UpdateFlowToolArgsSchema } from '../schemas.js';
import { normalizeFlowPayload } from './flow-payload-utils.js';

export async function updateFlow(client: NodeRedClient, args: unknown) {
  const parsed = UpdateFlowToolArgsSchema.parse(args);

  if (parsed.flow.id && parsed.flow.id !== parsed.flowId) {
    throw new Error(`flow.id (${parsed.flow.id}) must match flowId (${parsed.flowId})`);
  }

  const normalizedFlow = normalizeFlowPayload({
    ...parsed.flow,
    id: parsed.flowId,
  } as typeof parsed.flow);
  const validated = NodeRedUpdateFlowRequestSchema.parse(normalizedFlow);

  const result = await client.updateFlow(parsed.flowId, validated);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
