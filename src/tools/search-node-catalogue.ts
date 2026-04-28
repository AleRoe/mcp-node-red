import { z } from 'zod';
import type { NodeRedClient } from '../client.js';
import type { NodeCatalogueModule } from '../schemas.js';

const SearchNodeCatalogueArgsSchema = z.object({
  text: z.string().optional(),
  module: z.string().optional(),
  nodeType: z.string().optional(),
  keyword: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function searchNodeCatalogue(client: NodeRedClient, args: unknown) {
  const parsed = SearchNodeCatalogueArgsSchema.parse(args ?? {});
  const catalogue = await client.getNodeCatalogue();
  const results = catalogue.modules
    .map((module) => ({
      module,
      score: scoreModule(module, parsed),
    }))
    .filter((item) => item.score > 0 || matchesExactFilters(item.module, parsed))
    .sort((left, right) => {
      return right.score - left.score || left.module.id.localeCompare(right.module.id);
    })
    .slice(0, parsed.limit)
    .map(({ module, score }) => ({
      id: module.id,
      version: module.version ?? '',
      description: module.description ?? '',
      updatedAt: module.updated_at ?? '',
      types: module.types ?? [],
      keywords: module.keywords ?? [],
      url: module.url ?? '',
      score,
    }));

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            catalogueName: catalogue.name ?? 'Node-RED Community catalogue',
            catalogueUpdatedAt: catalogue.updated_at ?? '',
            query: parsed,
            totalModules: catalogue.modules.length,
            returnedResults: results.length,
            results,
          },
          null,
          2
        ),
      },
    ],
  };
}

function scoreModule(
  module: NodeCatalogueModule,
  query: {
    text?: string;
    module?: string;
    nodeType?: string;
    keyword?: string;
  }
) {
  let score = 0;

  if (query.module) {
    const normalizedModule = query.module.toLowerCase();
    if (module.id.toLowerCase() === normalizedModule) {
      score += 100;
    } else if (module.id.toLowerCase().includes(normalizedModule)) {
      score += 30;
    }
  }

  if (query.nodeType) {
    const normalizedType = query.nodeType.toLowerCase();
    for (const type of module.types ?? []) {
      if (type.toLowerCase() === normalizedType) {
        score += 60;
      } else if (type.toLowerCase().includes(normalizedType)) {
        score += 20;
      }
    }
  }

  if (query.keyword) {
    const normalizedKeyword = query.keyword.toLowerCase();
    for (const keyword of module.keywords ?? []) {
      if (keyword.toLowerCase() === normalizedKeyword) {
        score += 40;
      } else if (keyword.toLowerCase().includes(normalizedKeyword)) {
        score += 10;
      }
    }
  }

  if (query.text) {
    const tokens = tokenize(query.text);
    const haystack = [
      module.id,
      module.description ?? '',
      ...(module.types ?? []),
      ...(module.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();

    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += 8;
      }
      if (module.id.toLowerCase().includes(token)) {
        score += 8;
      }
      if ((module.types ?? []).some((type) => type.toLowerCase().includes(token))) {
        score += 6;
      }
    }
  }

  return score;
}

function matchesExactFilters(
  module: NodeCatalogueModule,
  query: {
    text?: string;
    module?: string;
    nodeType?: string;
    keyword?: string;
  }
) {
  const moduleFilter = query.module?.toLowerCase();
  const nodeTypeFilter = query.nodeType?.toLowerCase();
  const keywordFilter = query.keyword?.toLowerCase();

  if (moduleFilter && !module.id.toLowerCase().includes(moduleFilter)) {
    return false;
  }
  if (
    nodeTypeFilter &&
    !(module.types ?? []).some((type) => type.toLowerCase().includes(nodeTypeFilter))
  ) {
    return false;
  }
  if (
    keywordFilter &&
    !(module.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(keywordFilter))
  ) {
    return false;
  }
  if (query.text) {
    return scoreModule(module, { text: query.text }) > 0;
  }
  return true;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@._/-]+/)
    .filter((token) => token.length >= 2);
}
