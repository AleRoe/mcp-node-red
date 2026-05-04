import type { NodeRedClient } from '../client.js';
import { CreateFlowToolArgsSchema } from '../schemas.js';
import { normalizeFlowPayload } from './flow-payload-utils.js';

export async function createFlow(client: NodeRedClient, args: unknown) {
  const parsed = CreateFlowToolArgsSchema.parse(args);
  const result = await client.createFlow(normalizeFlowPayload(parsed.flow));

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
