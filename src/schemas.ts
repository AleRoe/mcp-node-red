import { z } from 'zod';

export const NodeRedNodeSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.string().optional(),
    name: z.string().optional(),
    wires: z.array(z.array(z.string())).optional(),
    credentials: z.unknown().optional(),
  })
  .passthrough();

export const NodeRedFlowSchema = z
  .object({
    id: z.string(),
    type: z.literal('tab'),
    label: z.string(),
    disabled: z.boolean().optional(),
    info: z.string().optional(),
    env: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const NodeRedConfigSchema = z
  .object({
    id: z.string(),
    type: z.string(),
  })
  .passthrough();

export const NodeRedItemSchema = z.union([NodeRedFlowSchema, NodeRedNodeSchema]);

export const NodeRedSubflowWireSchema = z
  .object({
    id: z.string(),
    port: z.number().int().min(0).optional(),
  })
  .passthrough();

export const NodeRedSubflowPortSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    wires: z.array(NodeRedSubflowWireSchema),
  })
  .passthrough();

export const NodeRedSubflowSchema = z
  .object({
    id: z.string(),
    type: z.literal('subflow'),
    name: z.string().optional(),
    info: z.string().optional(),
    in: z.array(NodeRedSubflowPortSchema).optional(),
    out: z.array(NodeRedSubflowPortSchema).optional(),
    env: z.array(z.unknown()).optional(),
    meta: z.unknown().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    status: z.unknown().optional(),
    configs: z.array(NodeRedConfigSchema).optional(),
    nodes: z.array(NodeRedNodeSchema).optional(),
  })
  .passthrough();

export const NodeRedSingleFlowSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    disabled: z.boolean().optional(),
    info: z.string().optional(),
    env: z.array(z.unknown()).optional(),
    nodes: z.array(NodeRedNodeSchema),
    configs: z.array(NodeRedConfigSchema).optional(),
  })
  .passthrough();

export const NodeRedGlobalFlowSchema = z
  .object({
    id: z.literal('global'),
    configs: z.array(NodeRedConfigSchema).optional(),
    subflows: z.array(NodeRedSubflowSchema).optional(),
  })
  .passthrough();

export const NodeRedFlowDefinitionSchema = z.union([
  NodeRedSingleFlowSchema,
  NodeRedGlobalFlowSchema,
]);

export const NodeRedCreateFlowRequestSchema = NodeRedSingleFlowSchema.extend({
  id: z.string().optional(),
});

export const NodeRedUpdateSingleFlowRequestSchema = NodeRedSingleFlowSchema.extend({
  id: z.string().optional(),
});

export const NodeRedUpdateGlobalFlowRequestSchema = NodeRedGlobalFlowSchema.extend({
  id: z.literal('global').optional(),
});

export const NodeRedUpdateFlowRequestSchema = z.union([
  NodeRedUpdateSingleFlowRequestSchema,
  NodeRedUpdateGlobalFlowRequestSchema,
]);

export const NodeRedFlowsResponseSchema = z.object({
  rev: z.string(),
  flows: z.array(NodeRedItemSchema),
});

export const FlowStateSchema = z.object({
  state: z.enum(['start', 'stop']),
});

export const NodeSetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    types: z.array(z.string()),
    enabled: z.boolean(),
    local: z.boolean().optional(),
    user: z.boolean().optional(),
    module: z.string(),
    version: z.string().optional(),
  })
  .passthrough();

export const NodeModuleSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    local: z.boolean().optional(),
    user: z.boolean().optional(),
    nodes: z.union([z.record(z.string(), NodeSetSchema), z.array(NodeSetSchema)]).optional(),
  })
  .passthrough();

export const NodeRedSettingsSchema = z
  .object({
    httpNodeRoot: z.string().optional(),
    version: z.string().optional(),
    user: z
      .object({
        username: z.string(),
        permissions: z.string(),
      })
      .optional(),
  })
  .passthrough();

export const NodeRedDiagnosticsSchema = z
  .object({
    report: z.string().optional(),
    scope: z.string().optional(),
    nodejs: z.unknown().optional(),
    os: z.unknown().optional(),
    runtime: z.unknown().optional(),
    modules: z.unknown().optional(),
    settings: z.unknown().optional(),
  })
  .passthrough();

export const NodeCatalogueModuleSchema = z
  .object({
    id: z.string(),
    version: z.string().optional(),
    description: z.string().optional(),
    updated_at: z.string().optional(),
    types: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    url: z.string().url().optional(),
  })
  .passthrough();

export const NodeCatalogueSchema = z
  .object({
    name: z.string().optional(),
    updated_at: z.string().optional(),
    modules: z.array(NodeCatalogueModuleSchema),
  })
  .passthrough();

export const ConfigSchema = z.object({
  nodeRedUrl: z.string().url(),
  nodeRedToken: z.string().optional(),
  nodeRedCatalogueUrl: z.string().url().optional(),
});

export const AnalyzeFlowsArgsSchema = z.object({
  flowId: z.string().optional(),
});

export const CreateFlowToolArgsSchema = z.object({
  flow: NodeRedCreateFlowRequestSchema,
});

export const UpdateFlowToolArgsSchema = z.object({
  flowId: z.string(),
  flow: NodeRedUpdateFlowRequestSchema,
});

export const ValidateFlowToolArgsSchema = z.object({
  flow: NodeRedUpdateFlowRequestSchema,
});

export const DeleteFlowArgsSchema = z.object({
  flowId: z.string(),
});

export const SetFlowStateArgsSchema = z.object({
  state: z.enum(['start', 'stop']),
});

export const GetContextArgsSchema = z.object({
  scope: z.enum(['global', 'flow', 'node']),
  id: z.string().optional(),
  key: z.string().optional(),
  store: z.string().optional(),
});

export const DeleteContextArgsSchema = z.object({
  scope: z.enum(['global', 'flow', 'node']),
  id: z.string().optional(),
  key: z.string(),
  store: z.string().optional(),
});

export const InstallNodeArgsSchema = z.object({
  module: z.string(),
});

export const SetNodeModuleStateArgsSchema = z.object({
  module: z.string(),
  enabled: z.boolean(),
});

export const RemoveNodeModuleArgsSchema = z.object({
  module: z.string(),
});

export const TriggerInjectArgsSchema = z.object({
  nodeId: z.string(),
});

export const SetDebugStateArgsSchema = z.object({
  nodeId: z.string(),
  enabled: z.boolean(),
});

export const GetNodeCatalogArgsSchema = z.object({
  module: z.string().optional(),
  type: z.string().optional(),
});

export const GetNodeHelpArgsSchema = z.object({
  type: z.string().optional(),
  detail: z.enum(['summary', 'full']).optional().default('summary'),
  includeHtml: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
  maxChars: z.number().int().min(1000).max(50000).optional().default(12000),
});

export const SearchNodeCatalogueArgsSchema = z.object({
  text: z.string().optional(),
  module: z.string().optional(),
  nodeType: z.string().optional(),
  keyword: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const RecommendFlowImplementationArgsSchema = z.object({
  goal: z.string().min(1),
  constraints: z.string().optional(),
  existingFlowId: z.string().optional(),
});

export type NodeRedNode = z.infer<typeof NodeRedNodeSchema>;
export type NodeRedFlow = z.infer<typeof NodeRedFlowSchema>;
export type NodeRedConfig = z.infer<typeof NodeRedConfigSchema>;
export type NodeRedItem = z.infer<typeof NodeRedItemSchema>;
export type NodeRedSubflow = z.infer<typeof NodeRedSubflowSchema>;
export type NodeRedSingleFlow = z.infer<typeof NodeRedSingleFlowSchema>;
export type NodeRedGlobalFlow = z.infer<typeof NodeRedGlobalFlowSchema>;
export type NodeRedFlowDefinition = z.infer<typeof NodeRedFlowDefinitionSchema>;
export type NodeRedFlowsResponse = z.infer<typeof NodeRedFlowsResponseSchema>;
export type NodeRedCreateFlowRequest = z.infer<typeof NodeRedCreateFlowRequestSchema>;
export type NodeRedUpdateFlowRequest = z.infer<typeof NodeRedUpdateFlowRequestSchema>;
export type FlowState = z.infer<typeof FlowStateSchema>;
export type NodeSet = z.infer<typeof NodeSetSchema>;
export type NodeModule = z.infer<typeof NodeModuleSchema>;
export type NodeRedSettings = z.infer<typeof NodeRedSettingsSchema>;
export type NodeRedDiagnostics = z.infer<typeof NodeRedDiagnosticsSchema>;
export type NodeCatalogueModule = z.infer<typeof NodeCatalogueModuleSchema>;
export type NodeCatalogue = z.infer<typeof NodeCatalogueSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type AnalyzeFlowsArgs = z.infer<typeof AnalyzeFlowsArgsSchema>;
export type CreateFlowToolArgs = z.infer<typeof CreateFlowToolArgsSchema>;
export type UpdateFlowToolArgs = z.infer<typeof UpdateFlowToolArgsSchema>;
export type ValidateFlowToolArgs = z.infer<typeof ValidateFlowToolArgsSchema>;
export type DeleteFlowArgs = z.infer<typeof DeleteFlowArgsSchema>;
export type SetFlowStateArgs = z.infer<typeof SetFlowStateArgsSchema>;
export type GetContextArgs = z.infer<typeof GetContextArgsSchema>;
export type DeleteContextArgs = z.infer<typeof DeleteContextArgsSchema>;
export type InstallNodeArgs = z.infer<typeof InstallNodeArgsSchema>;
export type SetNodeModuleStateArgs = z.infer<typeof SetNodeModuleStateArgsSchema>;
export type RemoveNodeModuleArgs = z.infer<typeof RemoveNodeModuleArgsSchema>;
export type TriggerInjectArgs = z.infer<typeof TriggerInjectArgsSchema>;
export type SetDebugStateArgs = z.infer<typeof SetDebugStateArgsSchema>;
export type GetNodeCatalogArgs = z.infer<typeof GetNodeCatalogArgsSchema>;
export type GetNodeHelpArgs = z.infer<typeof GetNodeHelpArgsSchema>;
export type SearchNodeCatalogueArgs = z.infer<typeof SearchNodeCatalogueArgsSchema>;
export type RecommendFlowImplementationArgs = z.infer<typeof RecommendFlowImplementationArgsSchema>;
