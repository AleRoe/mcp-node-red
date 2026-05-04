import type { NodeRedClient } from '../client.js';
import { TriggerInjectArgsSchema } from '../schemas.js';

export async function triggerInject(client: NodeRedClient, args: unknown) {
  const parsed = TriggerInjectArgsSchema.parse(args);

  await client.triggerInject(parsed.nodeId);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ nodeId: parsed.nodeId, triggered: true }, null, 2),
      },
    ],
  };
}
