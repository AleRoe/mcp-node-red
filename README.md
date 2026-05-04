# Node-RED MCP Server

MCP server for Node-RED workflow management. Provides AI assistants with 22 tools to manage flows, node modules, context stores, runtime settings, public catalogue discovery, and richer implementation guidance through the Node-RED Admin API v2 plus live flow analysis helpers.

## Installation

<details>
<summary><strong>Claude Code</strong></summary>

**Standalone Node-RED:**
```bash
claude mcp add node-red -e NODE_RED_URL=http://localhost:1880 -e NODE_RED_TOKEN=your-api-token -- npx mcp-node-red
```

**Home Assistant Add-on (Basic Auth):**
```bash
claude mcp add node-red -e NODE_RED_URL=http://username:password@homeassistant.local:1880 -- npx mcp-node-red
```

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `~/.config/claude/claude_desktop_config.json` (Linux):

```json
{
  "mcpServers": {
    "node-red": {
      "command": "npx",
      "args": ["mcp-node-red"],
      "env": {
        "NODE_RED_URL": "http://localhost:1880",
        "NODE_RED_TOKEN": "your-api-token"
      }
    }
  }
}
```

Restart Claude Desktop to load the server.

</details>

## Running Modes

The package supports both local `stdio` transport and a long-running `streamable-http` service.

- `stdio` is the default and is meant for MCP clients that spawn the process directly
- `streamable-http` is meant for Docker and service-style deployments

### stdio Mode

No extra configuration is needed beyond `NODE_RED_URL` and optional `NODE_RED_TOKEN`.

### Streamable HTTP Mode

Set the following environment variables before starting the server:

- `MCP_TRANSPORT=streamable-http`
- `MCP_HOST=0.0.0.0`
- `MCP_PORT=3000`
- `MCP_PATH=/mcp`

Then start the packaged server normally:

```bash
node dist/index.js
```

The MCP endpoint will be available at `http://<host>:<port><path>`, for example `http://0.0.0.0:3000/mcp`.

## Configuration

### Environment Variables

- `NODE_RED_URL` (required): Your Node-RED instance URL
- `NODE_RED_TOKEN` (optional): API token for authentication
- `NODE_RED_CATALOGUE_URL` (optional): Override URL for the public Node-RED catalogue JSON. Default: `https://catalogue.nodered.org/catalogue.json`
- `MCP_TRANSPORT` (optional): `stdio` or `streamable-http`. Default: `stdio`
- `MCP_HOST` (optional): HTTP bind host for `streamable-http`. Default: `127.0.0.1`
- `MCP_PORT` (optional): HTTP bind port for `streamable-http`. Default: `3000`
- `MCP_PATH` (optional): HTTP endpoint path for `streamable-http`. Default: `/mcp`

### Environment Files

The server loads environment variables from `.env` and `.env.local` files in the working directory:

- `.env` -- Base defaults (tracked in version control if desired)
- `.env.local` -- Local overrides (gitignored, never committed)

Precedence (highest to lowest):
1. Real environment variables (e.g., set via shell or MCP config)
2. `.env.local`
3. `.env`

Copy `.env.example` as a starting template:
```bash
cp .env.example .env
```

## Tarball and Docker

Build a distributable tarball:

```bash
npm run package:tgz
```

That produces a file like `mcp-node-red-1.1.0.tgz` which can be installed into another project, including a Docker image:

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY mcp-node-red-1.1.0.tgz ./
RUN npm install --omit=dev ./mcp-node-red-1.1.0.tgz

ENV NODE_RED_URL=http://node-red:1880
ENV MCP_TRANSPORT=streamable-http
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=3000
ENV MCP_PATH=/mcp

CMD ["node", "node_modules/mcp-node-red/dist/index.js"]
```

Example `docker-compose.yml` service section:

```yaml
services:
  mcp-node-red:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_RED_URL: http://node-red:1880
      MCP_TRANSPORT: streamable-http
      MCP_HOST: 0.0.0.0
      MCP_PORT: 3000
      MCP_PATH: /mcp
```

In `streamable-http` mode, the package runs as a standalone MCP service suitable for remote MCP clients or sidecar/container deployment.

To build both distributable artifacts together:

```bash
npm run package
```

That produces:
- `mcp-node-red-<version>.tgz`
- `mcp-node-red.mcpb`

For a release-prep flow that runs tests first:

```bash
npm run publish:prep
```

### Node-RED Setup

#### Standalone Node-RED

1. Enable Admin API in Node-RED `settings.js`:
```javascript
adminAuth: {
  type: "credentials",
  users: [{
    username: "admin",
    password: "$2a$08$...",  // bcrypt hash
    permissions: "*"
  }]
}
```

2. Generate API token:
```bash
curl -X POST http://localhost:1880/auth/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"node-red-admin","grant_type":"password","scope":"*","username":"admin","password":"your-password"}'
```

#### Home Assistant Add-on

The Home Assistant Node-RED add-on uses Basic Auth with your Home Assistant credentials:

```bash
# Test connection
curl http://USERNAME:PASSWORD@homeassistant.local:1880/flows
```

**Configuration**:
```json
{
  "mcpServers": {
    "node-red": {
      "command": "npx",
      "args": ["mcp-node-red"],
      "env": {
        "NODE_RED_URL": "http://admin:your-ha-password@homeassistant.local:1880"
      }
    }
  }
}
```

Note: No `NODE_RED_TOKEN` needed - credentials are in the URL.

## Features

### Flow Management
- **get_flows**: Retrieve all flows from your Node-RED instance
- **analyze_flows**: Summarize flow topology, node types, entry points, and disconnected nodes
- **create_flow**: Create new flows via POST /flow using a structured flow object
- **update_flow**: Update individual flows safely via PUT /flow/:id using a structured flow object
- **validate_flow**: Validate structured flow configuration without deploying
- **delete_flow**: Delete a flow and all its nodes by ID

`create_flow` uses the single-flow `POST /flow` endpoint. This package does not currently expose bulk `POST /flows` deployment, so `Node-RED-Deployment-Type` is not yet user-configurable.

### Runtime Control
- **get_flow_state**: Get runtime state of flows (started/stopped)
- **set_flow_state**: Start or stop all flows in the runtime

### Node Module Management
- **get_nodes**: List all installed node modules with versions and status
- **get_node_catalog**: Correlate installed node sets with live usage in active flows
- **get_node_help**: Return node help text and editor argument descriptions parsed from the runtime node HTML
- **search_node_catalogue**: Search the public Node-RED community catalogue for installable modules
- **install_node**: Install a node module from the npm registry
- **set_node_module_state**: Enable or disable an installed node module
- **remove_node_module**: Uninstall a node module from Node-RED

### Context Store
- **get_context**: Read context data at global, flow, or node scope
- **delete_context**: Delete context values at any scope

### Runtime Info
- **get_settings**: Get Node-RED runtime settings including version
- **get_diagnostics**: Get system diagnostics (Node.js, OS, memory)

### Node Interaction
- **trigger_inject**: Trigger an inject node (same as clicking the button)
- **set_debug_state**: Enable or disable a debug node's output

### Implementation Guidance
- **recommend_flow_implementation**: Suggest Node-RED node choices, patterns, and best practices for a requested task using live installed-module and flow context

## Usage

Once configured, ask your AI assistant natural language questions:

```
Get all flows from my Node-RED instance
```

```
Create a new flow with label "Temperature Monitor"
```

```
Update flow "flow1" to change its label to "New Name"
```

```
Delete the flow with ID "flow1"
```

```
What node modules are installed?
```

```
Install the node-red-contrib-mqtt module
```

```
Trigger the inject node to test my flow
```

```
Show me the global context data
```

```
Get the Node-RED runtime settings and version
```

## Safety Features

- **Individual flow updates**: Uses PUT /flow/:id to update only the specified flow
- **No accidental deletions**: Other flows remain completely untouched
- **Validation**: All flow configurations are validated before sending to Node-RED
- **Structured contracts**: Flow tools use explicit object schemas instead of JSON-in-string arguments
- **Consistent API versioning**: Node-RED requests use `Node-RED-API-Version: v2`
- **Read-only by default**: Only modifies flows when explicitly requested
- **Module management guards**: Core modules cannot be removed; enable/disable is reversible
- **Scoped context operations**: Context reads and deletes are scoped to specific keys

## Development

See [docs/development.md](docs/development.md) for development setup, testing, and contribution guidelines.

## License

MIT
