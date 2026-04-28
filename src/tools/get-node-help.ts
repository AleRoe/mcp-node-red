import { z } from 'zod';
import type { NodeRedClient } from '../client.js';
import { parseNodeHelpCatalog, summarizeNodeHelpCatalog } from './context-utils.js';

const GetNodeHelpArgsSchema = z.object({
  type: z.string().optional(),
});

export async function getNodeHelp(client: NodeRedClient, args: unknown) {
  const parsed = GetNodeHelpArgsSchema.parse(args ?? {});
  const html = await client.getNodesHtml();
  const catalog = parseNodeHelpCatalog(html);

  if (parsed.type) {
    const entry = catalog.get(parsed.type);
    if (!entry) {
      throw new Error(`Node help not found for type: ${parsed.type}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(entry, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(summarizeNodeHelpCatalog(catalog), null, 2),
      },
    ],
  };
}
