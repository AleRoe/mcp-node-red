import type { NodeRedClient } from '../client.js';
import { NodeRedUpdateFlowRequestSchema, ValidateFlowToolArgsSchema } from '../schemas.js';
import { normalizeFlowPayload } from './flow-payload-utils.js';

export async function validateFlow(client: NodeRedClient, args: unknown) {
  const parsed = ValidateFlowToolArgsSchema.parse(args);
  const validated = NodeRedUpdateFlowRequestSchema.parse(normalizeFlowPayload(parsed.flow));
  const result = await client.validateFlow(validated);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
