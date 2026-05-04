import type { NodeRedClient } from '../client.js';
import { GetNodeHelpArgsSchema } from '../schemas.js';
import {
  type NodeHelpEntry,
  parseNodeHelpCatalog,
  summarizeNodeHelpCatalog,
} from './context-utils.js';

export async function getNodeHelp(client: NodeRedClient, args: unknown) {
  const parsed = GetNodeHelpArgsSchema.parse(args ?? {});
  const html = await client.getNodesHtml();
  const catalog = parseNodeHelpCatalog(html);

  if (parsed.type) {
    const entry = catalog.get(parsed.type);
    if (!entry) {
      throw new Error(`Node help not found for type: ${parsed.type}`);
    }

    const payload =
      parsed.detail === 'full'
        ? buildDetailedEntry(entry, parsed.includeHtml)
        : buildSummaryEntry(entry);
    const trimmedPayload = trimNodeHelpPayload(payload, parsed.maxChars);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(trimmedPayload, null, 2),
        },
      ],
    };
  }

  const summary = summarizeNodeHelpCatalog(catalog);
  const limitedNodeTypes = summary.nodeTypes.slice(0, parsed.limit);
  const payload = trimNodeHelpPayload(
    {
      ...summary,
      returnedNodeTypes: limitedNodeTypes.length,
      truncated: summary.nodeTypes.length > limitedNodeTypes.length,
      nodeTypes: limitedNodeTypes,
    },
    parsed.maxChars
  );

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function buildSummaryEntry(entry: NodeHelpEntry) {
  const summarySection =
    entry.sections.find((section) => section.body.trim().length > 0)?.body ?? entry.helpText;

  return {
    type: entry.type,
    summary: clampText(firstSentence(summarySection), 400),
    isConfigNode: looksLikeConfigNode(entry.type),
    hasHelp: entry.helpText.length > 0,
    argumentCount: entry.arguments.length,
    sectionTitles: entry.sections.map((section) => section.title),
    keyArguments: entry.arguments.slice(0, 8),
  };
}

function buildDetailedEntry(entry: NodeHelpEntry, includeHtml: boolean) {
  return {
    type: entry.type,
    helpText: entry.helpText,
    sections: entry.sections,
    arguments: entry.arguments,
    ...(includeHtml ? { helpHtml: entry.helpHtml } : {}),
  };
}

function trimNodeHelpPayload(payload: unknown, maxChars: number) {
  const initial = JSON.stringify(payload, null, 2);
  if (initial.length <= maxChars) {
    return payload;
  }

  if (isDetailedEntryPayload(payload)) {
    const trimmedSections = payload.sections.slice(0, 6).map((section) => ({
      ...section,
      body: clampText(section.body, 800),
      ...(section.properties
        ? {
            properties: section.properties.slice(0, 12).map((property) => ({
              ...property,
              description: clampText(property.description, 200),
            })),
          }
        : {}),
    }));
    const trimmedArguments = payload.arguments.slice(0, 16).map((argument) => ({
      ...argument,
      description: clampText(argument.description, 200),
      placeholder: argument.placeholder
        ? clampText(argument.placeholder, 120)
        : argument.placeholder,
    }));

    const trimmed = {
      ...payload,
      helpText: clampText(payload.helpText, Math.max(1200, Math.floor(maxChars / 3))),
      sections: trimmedSections,
      arguments: trimmedArguments,
      ...(payload.helpHtml
        ? { helpHtml: clampText(payload.helpHtml, Math.max(1000, Math.floor(maxChars / 4))) }
        : {}),
      truncated: true,
    };

    if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
      return trimmed;
    }

    return {
      ...buildSummaryEntry({
        type: payload.type,
        helpHtml: payload.helpHtml ?? '',
        helpText: payload.helpText,
        sections: payload.sections,
        arguments: payload.arguments,
      }),
      truncated: true,
    };
  }

  if (isCatalogPayload(payload)) {
    const limitedNodeTypes = payload.nodeTypes.slice(
      0,
      Math.max(5, Math.floor(payload.nodeTypes.length / 2))
    );
    const trimmed = {
      ...payload,
      returnedNodeTypes: limitedNodeTypes.length,
      truncated: true,
      nodeTypes: limitedNodeTypes,
    };

    if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
      return trimmed;
    }

    return {
      totalNodeTypes: payload.totalNodeTypes,
      returnedNodeTypes: Math.min(10, payload.nodeTypes.length),
      truncated: true,
      summary: payload.summary,
      suggestedStartingPoints: payload.suggestedStartingPoints.slice(0, 3),
      nodeTypes: payload.nodeTypes.slice(0, 10),
    };
  }

  return {
    truncated: true,
    summary: clampText(initial, maxChars - 32),
  };
}

function clampText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 16)).trimEnd()}\n...[truncated]`;
}

function firstSentence(value: string) {
  const firstLine = value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '';
  }

  const sentenceMatch = firstLine.match(/^(.+?[.!?])(?:\s|$)/);
  return sentenceMatch?.[1] ?? firstLine;
}

function looksLikeConfigNode(type: string) {
  const normalized = type.toLowerCase();
  return (
    normalized.includes('config') ||
    normalized.endsWith('-broker') ||
    normalized.endsWith('-listener') ||
    normalized.endsWith('-client')
  );
}

function isDetailedEntryPayload(value: unknown): value is {
  type: string;
  helpText: string;
  sections: NodeHelpEntry['sections'];
  arguments: NodeHelpEntry['arguments'];
  helpHtml?: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'helpText' in value &&
    'sections' in value &&
    'arguments' in value
  );
}

function isCatalogPayload(value: unknown): value is ReturnType<typeof summarizeNodeHelpCatalog> & {
  returnedNodeTypes: number;
  truncated: boolean;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'totalNodeTypes' in value &&
    'nodeTypes' in value &&
    'summary' in value
  );
}
