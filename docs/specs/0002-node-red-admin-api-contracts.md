# Node-RED Admin API Contracts

## Purpose

Define the Node-RED request and response shapes that `node_red_mcp` treats as authoritative, with a particular focus on flow creation, flow updates, and MCP tool argument contracts.

This document is intentionally narrower than the full Admin API reference. It captures the endpoint payloads we actively depend on and the local validation rules we enforce on top of them.

## Primary References

- [Node-RED Admin API Methods](https://nodered.org/docs/api/admin/methods/)
- [Node-RED Admin API Types](https://nodered.org/docs/api/admin/types)
- [POST /flow](https://nodered.org/docs/api/admin/methods/post/flow/)
- [PUT /flow/:id](https://nodered.org/docs/api/admin/methods/put/flow/)
- [GET /flows](https://nodered.org/docs/api/admin/methods/get/flows/)

## Authoritative Node-RED Shapes

### Node

The docs define a Node as an object with required `id` and `type`, plus flow-local fields such as `x`, `y`, `z`, and `wires`, followed by type-specific fields.

Local contract:
- `id`: required string
- `type`: required string
- `x`, `y`, `z`, `wires`: optional
- additional fields: allowed via passthrough

We intentionally keep node payloads permissive because Node-RED nodes are highly type-specific.

### Config Node

The docs note that config nodes must not include `x`, `y`, or `wires`.

Local contract:
- `id`: required string
- `type`: required string
- additional fields: allowed via passthrough

We do not currently hard-reject accidental `x`, `y`, or `wires` on config nodes. That remains a future tightening option if needed.

### Single Flow Configuration

Node-RED uses this for `POST /flow` and normal `PUT /flow/:id` requests.

Docs shape:

```json
{
  "id": "1234",
  "label": "Sheet1",
  "nodes": [],
  "configs": []
}
```

Local contract:
- `id`: required for update and validation, optional for create
- `label`: optional string
- `nodes`: required array for normal flows
- `configs`: optional array
- `disabled`, `info`, `env`: optional passthrough-adjacent fields we preserve

### Global Flow Configuration

Node-RED uses a different shape for `PUT /flow/global`.

Docs shape:

```json
{
  "id": "global",
  "configs": [],
  "subflows": []
}
```

Local contract:
- `id`: literal `"global"` for normalized payloads
- `configs`: optional array
- `subflows`: optional array

### Complete Flow Configuration v2

`GET /flows` with `Node-RED-API-Version: v2` returns:

```json
{
  "rev": "abc-123",
  "flows": []
}
```

Local contract:
- `rev`: required string
- `flows`: required array of flat flow items

## MCP Tool Contracts

### `create_flow`

Maps to `POST /flow`.

Important doc behavior:
- `nodes` is the minimum required field
- if `id` is provided, Node-RED may replace it and rewrite each node's `z`

Local MCP contract:

```json
{
  "flow": {
    "id": "optional",
    "label": "optional",
    "nodes": [],
    "configs": []
  }
}
```

Design choice:
- `flow` is a structured object, not a JSON string
- `flow.id` is optional because the runtime may assign the actual id

### `update_flow`

Maps to `PUT /flow/:id`.

Local MCP contract:

```json
{
  "flowId": "target-flow-id",
  "flow": {
    "id": "optional-but-must-match-if-present",
    "label": "optional",
    "nodes": [],
    "configs": []
  }
}
```

Design choices:
- `flow` is structured, not a JSON string
- if `flow.id` is omitted, the server fills it from `flowId`
- if `flow.id` is present and different from `flowId`, the request is rejected

This removes a silent overwrite behavior that could hide user mistakes.

### `validate_flow`

This is a local validation helper, not a Node-RED endpoint.

Local MCP contract:
- accepts the same structured flow payload family used by updates
- supports both normal flows and the special `global` flow shape

Current validation checks:
- flow id exists
- normal flows include `nodes`
- nodes have `id` and `type`
- config nodes have `id` and `type`
- subflows have `id` and `type`
- duplicate ids are rejected within nodes, configs, and subflows respectively

## Local Assumptions and Deviations

- We use permissive `.passthrough()` contracts for Node-RED entities because node-specific settings vary widely by node type.
- We model the `global` flow explicitly instead of treating all flows as one generic object.
- We do not yet validate every Node-RED editor rule, such as config-node-only field restrictions or cross-reference integrity between wires and node ids.
- `createFlow()` may receive a `204` response without a body. If the request omitted `flow.id`, the client cannot infer the runtime-assigned id and returns an acknowledgement without one.

## Why This Matters For `server.registerTool`

The MCP migration works better when each tool has a single structured contract:

- MCP input args are defined in shared Zod schemas
- tool handlers parse those contracts directly
- Node-RED payload schemas are separate from MCP wrapper args

That separation lets us reuse the same Zod contracts for:
- tool registration
- runtime validation
- tests
- future generated JSON Schema or adapter layers
