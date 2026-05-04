import type { NodeRedClient } from '../client.js';
import { InstallNodeArgsSchema } from '../schemas.js';

export async function installNode(client: NodeRedClient, args: unknown) {
  const parsed = InstallNodeArgsSchema.parse(args);
  const result = await client.installNode(parsed.module);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
