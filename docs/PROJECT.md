# Project Backlog

## Todo

- [ ] Add structured tool outputs for stable JSON-returning tools.
  Investigate introducing `structuredContent` plus `outputSchema` for tools with predictable result shapes so MCP clients and LLMs can rely on a documented response contract. Prefer returning both `structuredContent` and a JSON text block in `content` for compatibility.
