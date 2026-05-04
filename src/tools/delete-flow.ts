import type { NodeRedClient } from '../client.js';
import { DeleteFlowArgsSchema } from '../schemas.js';

export async function deleteFlow(client: NodeRedClient, args: unknown) {
  const parsed = DeleteFlowArgsSchema.parse(args);

  await client.deleteFlow(parsed.flowId);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ deleted: parsed.flowId }, null, 2),
      },
    ],
  };
}
