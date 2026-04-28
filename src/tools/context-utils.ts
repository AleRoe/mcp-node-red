import type { NodeModule, NodeRedFlowsResponse, NodeRedItem } from '../schemas.js';

type FlowTab = Extract<NodeRedItem, { type: 'tab' }>;
type FlowNode = Exclude<NodeRedItem, { type: 'tab' }>;

export type FlowAnalysis = {
  flow: FlowTab;
  nodes: FlowNode[];
  configNodes: FlowNode[];
  nodeTypeCounts: Array<{ type: string; count: number }>;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  disconnectedNodeIds: string[];
};

export type NodeHelpEntry = {
  type: string;
  helpHtml: string;
  helpText: string;
  sections: Array<{
    title: string;
    body: string;
    properties?: Array<{ name: string; type?: string; description: string; optional: boolean }>;
  }>;
  arguments: Array<{
    name: string;
    label: string;
    description: string;
    inputType?: string;
    placeholder?: string;
    required?: boolean;
  }>;
};

export function summarizeFlows(flowsResponse: NodeRedFlowsResponse): FlowAnalysis[] {
  const tabs = flowsResponse.flows.filter((item): item is FlowTab => item.type === 'tab');
  const nonTabs = flowsResponse.flows.filter((item): item is FlowNode => item.type !== 'tab');
  const nodesByFlow = new Map<string, FlowNode[]>();

  for (const item of nonTabs) {
    if (typeof item.z === 'string' && item.z.length > 0) {
      const items = nodesByFlow.get(item.z) ?? [];
      items.push(item);
      nodesByFlow.set(item.z, items);
    }
  }

  return tabs.map((flow) => {
    const nodes = nodesByFlow.get(flow.id) ?? [];
    const configNodes = nonTabs.filter((item) => item.z !== flow.id && !item.z);
    const nodeTypeCounts = countByType(nodes);
    const entryNodeIds = nodes
      .filter((node) => !hasIncomingWire(nodes, node.id))
      .map((node) => node.id);
    const terminalNodeIds = nodes.filter((node) => !hasOutgoingWire(node)).map((node) => node.id);
    const disconnectedNodeIds = nodes
      .filter((node) => !hasIncomingWire(nodes, node.id) && !hasOutgoingWire(node))
      .map((node) => node.id);

    return {
      flow,
      nodes,
      configNodes,
      nodeTypeCounts,
      entryNodeIds,
      terminalNodeIds,
      disconnectedNodeIds,
    };
  });
}

export function flattenInstalledNodeSets(modules: NodeModule[]) {
  return modules.flatMap((module) => {
    const nodeSets = Array.isArray(module.nodes)
      ? module.nodes
      : module.nodes
        ? Object.values(module.nodes)
        : [];

    return nodeSets.map((nodeSet) => ({
      module: module.name,
      moduleVersion: module.version,
      nodeSetId: nodeSet.id,
      nodeSetName: nodeSet.name,
      enabled: nodeSet.enabled,
      local: nodeSet.local ?? module.local ?? false,
      user: nodeSet.user ?? module.user ?? false,
      types: nodeSet.types,
    }));
  });
}

export function countByType(nodes: FlowNode[]) {
  const counts = new Map<string, number>();

  for (const node of nodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

export function findFlowById(flowsResponse: NodeRedFlowsResponse, flowId: string) {
  return summarizeFlows(flowsResponse).find((item) => item.flow.id === flowId);
}

export function inferImplementationPatterns(goal: string) {
  const normalizedGoal = goal.toLowerCase();
  const patterns: Array<{
    topic: string;
    trigger: RegExp;
    nodes: string[];
    guidance: string[];
  }> = [
    {
      topic: 'HTTP endpoint',
      trigger: /\b(http|https|api|webhook|endpoint|rest)\b/,
      nodes: ['http in', 'http request', 'http response', 'change', 'debug'],
      guidance: [
        'Start with `http in` only when Node-RED should host the endpoint; use `http request` when the flow calls an external API.',
        'Normalize incoming payloads with `change` before branching so downstream nodes see a stable message shape.',
        'Always finish hosted HTTP flows with `http response` to avoid hanging requests.',
      ],
    },
    {
      topic: 'Scheduled or polling flow',
      trigger: /\b(schedule|cron|timer|interval|poll|every)\b/,
      nodes: ['inject', 'http request', 'switch', 'debug'],
      guidance: [
        'Use `inject` for repeat schedules and keep the polling cadence conservative until the flow is proven stable.',
        'Add a `switch` after the fetch step to separate success, empty, and error paths explicitly.',
      ],
    },
    {
      topic: 'Message transformation',
      trigger: /\b(transform|map|convert|json|payload|format|template)\b/,
      nodes: ['change', 'template', 'json', 'function', 'debug'],
      guidance: [
        'Prefer `change`, `template`, and `json` nodes before reaching for `function` so the flow stays easier to inspect and maintain.',
        'Use `debug` on the transformed payload while iterating, then disable or remove noisy debug nodes once stable.',
      ],
    },
    {
      topic: 'Conditional routing',
      trigger: /\b(condition|branch|if|route|filter|decision)\b/,
      nodes: ['switch', 'change', 'link out', 'link in'],
      guidance: [
        'Use `switch` for explicit routing rules and keep each branch narrow in responsibility.',
        'If the canvas gets crowded, split long routes with `link out` and `link in` instead of crossing wires everywhere.',
      ],
    },
    {
      topic: 'MQTT or event-driven automation',
      trigger: /\b(mqtt|event|subscribe|publish|topic|broker)\b/,
      nodes: ['mqtt in', 'mqtt out', 'switch', 'change', 'debug'],
      guidance: [
        'Normalize topic and payload fields early so event handlers can share common downstream logic.',
        'Separate subscription ingestion from business logic with a `link out` or subflow if multiple automations reuse the same event source.',
      ],
    },
  ];

  return patterns.filter((pattern) => pattern.trigger.test(normalizedGoal));
}

export function suggestInstalledModules(goal: string, modules: NodeModule[]) {
  const tokens = tokenize(goal);

  return flattenInstalledNodeSets(modules)
    .map((item) => {
      const searchable = [item.module, item.nodeSetName, ...item.types].join(' ').toLowerCase();
      const score = tokens.reduce(
        (total, token) => total + (searchable.includes(token) ? 1 : 0),
        0
      );
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.module.localeCompare(right.module))
    .slice(0, 8)
    .map(({ score: _score, ...item }) => item);
}

export function buildBestPractices() {
  return [
    'Keep `msg.payload` predictable and move auxiliary metadata into named properties such as `msg.topic`, `msg.headers`, or `msg.meta`.',
    'Prototype with `inject` and `debug` nodes first, then replace manual triggers with production triggers once the message shape is stable.',
    'Prefer declarative nodes like `change`, `switch`, `template`, and `json` before custom `function` code.',
    'Use config nodes for shared credentials and connections rather than duplicating connection details across many nodes.',
    'Name important nodes and tabs clearly so downstream tooling and human operators can understand the flow quickly.',
  ];
}

export function parseNodeHelpCatalog(html: string) {
  const templateBlocks = extractScriptBlocks(html, 'data-template-name');
  const helpBlocks = extractScriptBlocks(html, 'data-help-name');
  const allTypes = new Set([...templateBlocks.keys(), ...helpBlocks.keys()]);
  const entries = new Map<string, NodeHelpEntry>();

  for (const type of allTypes) {
    const helpHtml = helpBlocks.get(type) ?? '';
    const templateHtml = templateBlocks.get(type) ?? '';
    entries.set(type, {
      type,
      helpHtml,
      helpText: htmlToText(helpHtml),
      sections: parseHelpSections(helpHtml),
      arguments: parseTemplateArguments(templateHtml),
    });
  }

  return entries;
}

export function summarizeNodeHelpCatalog(catalog: Map<string, NodeHelpEntry>) {
  const entries = Array.from(catalog.values());
  const nodeTypes = entries
    .map((entry) => {
      const family = classifyNodeType(entry.type);
      const summary = extractSummary(
        entry.sections.map((section) => section.body).find((body) => body.trim().length > 0) ??
          entry.helpText
      );
      const keyArguments = entry.arguments.slice(0, 6).map((argument) => ({
        name: argument.name,
        label: argument.label,
        description: argument.description,
      }));

      return {
        type: entry.type,
        family,
        summary,
        isConfigNode: isConfigNodeType(entry.type),
        hasHelp: entry.helpText.length > 0,
        argumentCount: entry.arguments.length,
        keyArguments,
        sectionTitles: entry.sections.map((section) => section.title),
      };
    })
    .sort((left, right) => left.type.localeCompare(right.type));

  const familyCounts = Array.from(
    nodeTypes.reduce((counts, entry) => {
      counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  )
    .map(([family, count]) => ({ family, count }))
    .sort((left, right) => right.count - left.count || left.family.localeCompare(right.family));

  return {
    totalNodeTypes: nodeTypes.length,
    summary: {
      nodesWithHelp: nodeTypes.filter((entry) => entry.hasHelp).length,
      nodesWithArguments: nodeTypes.filter((entry) => entry.argumentCount > 0).length,
      configNodeTypes: nodeTypes.filter((entry) => entry.isConfigNode).length,
      familyCounts,
    },
    suggestedStartingPoints: [
      {
        scenario: 'Build or inspect HTTP flows',
        nodeTypes: ['http in', 'http request', 'http response', 'json', 'debug'],
      },
      {
        scenario: 'Build event or automation flows',
        nodeTypes: ['inject', 'switch', 'change', 'debug', 'trigger'],
      },
      {
        scenario: 'Work with MQTT',
        nodeTypes: ['mqtt in', 'mqtt out', 'mqtt-broker', 'switch', 'debug'],
      },
      {
        scenario: 'Work with this MCP integration',
        nodeTypes: ['mcp-tool-in', 'mcp-response', 'mcp-progress', 'mcp-tool-result-composer'],
      },
    ],
    nodeTypes,
  };
}

function hasOutgoingWire(node: FlowNode) {
  return Array.isArray(node.wires) && node.wires.some((group) => group.length > 0);
}

function hasIncomingWire(nodes: FlowNode[], nodeId: string) {
  return nodes.some((node) => node.wires?.some((group) => group.includes(nodeId)));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function extractScriptBlocks(html: string, attributeName: 'data-template-name' | 'data-help-name') {
  const blocks = new Map<string, string>();
  const pattern = new RegExp(
    `<script[^>]*${attributeName}=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/script>`,
    'gi'
  );

  for (const match of html.matchAll(pattern)) {
    const type = match[1]?.trim();
    const content = match[2] ?? '';
    if (type) {
      blocks.set(type, content);
    }
  }

  return blocks;
}

function parseHelpSections(helpHtml: string) {
  if (!helpHtml.trim()) {
    return [];
  }

  const sections: Array<{
    title: string;
    body: string;
    properties?: Array<{ name: string; type?: string; description: string; optional: boolean }>;
  }> = [];
  const sectionPattern = /<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3>|$)/gi;

  for (const match of helpHtml.matchAll(sectionPattern)) {
    const title = htmlToText(match[1]);
    const bodyHtml = match[2] ?? '';
    const properties = parseMessageProperties(bodyHtml);
    sections.push({
      title,
      body: htmlToText(bodyHtml),
      ...(properties.length > 0 ? { properties } : {}),
    });
  }

  return sections;
}

function parseMessageProperties(sectionHtml: string) {
  const properties: Array<{ name: string; type?: string; description: string; optional: boolean }> =
    [];
  const propertyPattern =
    /<dt([^>]*)>([\s\S]*?)(?:<span class="property-type">([\s\S]*?)<\/span>)?<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi;

  for (const match of sectionHtml.matchAll(propertyPattern)) {
    properties.push({
      name: htmlToText(match[2]).replace(/\s+/g, ' ').trim(),
      type: match[3] ? htmlToText(match[3]).trim() : undefined,
      description: htmlToText(match[4]),
      optional: /\boptional\b/i.test(match[1] ?? ''),
    });
  }

  return properties;
}

function parseTemplateArguments(templateHtml: string) {
  if (!templateHtml.trim()) {
    return [];
  }

  const argumentsList: Array<{
    name: string;
    label: string;
    description: string;
    inputType?: string;
    placeholder?: string;
    required?: boolean;
  }> = [];

  const formRowPattern = /<div[^>]*class=["'][^"']*form-row[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of templateHtml.matchAll(formRowPattern)) {
    const rowHtml = match[1] ?? '';
    const labelMatch = rowHtml.match(/<label[^>]*for=["']([^"']+)["'][^>]*>([\s\S]*?)<\/label>/i);
    if (!labelMatch) {
      continue;
    }

    const labelFor = labelMatch[1];
    const label = htmlToText(labelMatch[2]);
    const name = normalizeArgumentName(labelFor);
    const tooltipMatch = rowHtml.match(/data-tooltip=["']([^"']+)["']/i);
    const inputMatch = rowHtml.match(/<(input|select|textarea)\b([^>]*)>/i);
    const inputAttributes = inputMatch?.[2] ?? '';
    const explicitTypeMatch = inputAttributes.match(/\btype=["']([^"']+)["']/i);
    const placeholderMatch = rowHtml.match(/placeholder=["']([^"']+)["']/i);

    argumentsList.push({
      name,
      label,
      description: decodeHtmlEntities(tooltipMatch?.[1] ?? ''),
      inputType: explicitTypeMatch?.[1] ?? inputMatch?.[1],
      placeholder: decodeHtmlEntities(placeholderMatch?.[1] ?? ''),
      required: /\brequired\b/i.test(label),
    });
  }

  return argumentsList.filter((item, index, items) => {
    return items.findIndex((candidate) => candidate.name === item.name) === index;
  });
}

function normalizeArgumentName(value: string) {
  return value.replace(/^node-(?:input|config-input)-/, '');
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<code>([\s\S]*?)<\/code>/gi, '$1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/dd>/gi, '\n')
      .replace(/<\/dt>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function classifyNodeType(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.startsWith('mcp-')) {
    return 'mcp';
  }
  if (normalized.includes('mqtt')) {
    return 'mqtt';
  }
  if (normalized.includes('http') || normalized.includes('websocket')) {
    return 'network';
  }
  if (normalized.includes('tcp') || normalized.includes('udp') || normalized.includes('tls')) {
    return 'transport';
  }
  if (normalized.includes('file') || normalized === 'watch') {
    return 'storage';
  }
  if (
    [
      'change',
      'switch',
      'split',
      'join',
      'sort',
      'range',
      'template',
      'json',
      'xml',
      'yaml',
      'csv',
      'html',
      'rbe',
      'delay',
      'batch',
    ].includes(normalized)
  ) {
    return 'transform';
  }
  if (
    [
      'inject',
      'debug',
      'catch',
      'status',
      'complete',
      'trigger',
      'exec',
      'function',
      'comment',
      'unknown',
    ].includes(normalized)
  ) {
    return 'core';
  }
  if (
    normalized.includes('config') ||
    normalized.includes('broker') ||
    normalized.includes('listener') ||
    normalized.includes('client')
  ) {
    return 'config';
  }
  if (normalized.startsWith('link ')) {
    return 'flow-control';
  }

  return 'other';
}

function extractSummary(helpText: string) {
  const firstLine = helpText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '';
  }

  const sentenceMatch = firstLine.match(/^(.+?[.!?])(?:\s|$)/);
  return sentenceMatch?.[1] ?? firstLine;
}

function isConfigNodeType(type: string) {
  const normalized = type.toLowerCase();
  return (
    normalized.includes('config') ||
    normalized.endsWith('-broker') ||
    normalized.endsWith('-listener') ||
    normalized.endsWith('-client')
  );
}
