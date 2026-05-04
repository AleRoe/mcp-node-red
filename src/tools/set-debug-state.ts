import type { NodeRedClient } from '../client.js';
import { SetDebugStateArgsSchema } from '../schemas.js';

export async function setDebugState(client: NodeRedClient, args: unknown) {
  const parsed = SetDebugStateArgsSchema.parse(args);

  await client.setDebugNodeState(parsed.nodeId, parsed.enabled);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ nodeId: parsed.nodeId, enabled: parsed.enabled }, null, 2),
      },
    ],
  };
}
