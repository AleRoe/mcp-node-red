import type { NodeRedClient } from '../client.js';
import { GetContextArgsSchema } from '../schemas.js';

export async function getContext(client: NodeRedClient, args: unknown) {
  const parsed = GetContextArgsSchema.parse(args);

  if ((parsed.scope === 'flow' || parsed.scope === 'node') && !parsed.id) {
    throw new Error(`id is required when scope is "${parsed.scope}"`);
  }

  const result = await client.getContext(parsed.scope, parsed.id, parsed.key, parsed.store);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
