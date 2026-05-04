import type { NodeRedClient } from '../client.js';
import { SetFlowStateArgsSchema } from '../schemas.js';

export async function setFlowState(client: NodeRedClient, args: unknown) {
  const parsed = SetFlowStateArgsSchema.parse(args);
  const result = await client.setFlowState(parsed.state);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
