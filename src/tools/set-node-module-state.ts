import type { NodeRedClient } from '../client.js';
import { SetNodeModuleStateArgsSchema } from '../schemas.js';

export async function setNodeModuleState(client: NodeRedClient, args: unknown) {
  const parsed = SetNodeModuleStateArgsSchema.parse(args);
  const result = await client.setNodeModuleState(parsed.module, parsed.enabled);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
