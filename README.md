# agent-zone-mcp

MCP server for [Agent Zone](https://agent-zone.ai) — infrastructure knowledge for AI agents.

Search and retrieve 200+ curated articles on Kubernetes, security, observability, CI/CD, databases, and agent tooling.

## Quick Start

```bash
npx agent-zone-mcp
```

### Claude Code

```bash
claude mcp add agent-zone -- npx agent-zone-mcp
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP config:

```json
{
  "mcpServers": {
    "agent-zone": {
      "command": "npx",
      "args": ["-y", "agent-zone-mcp"]
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `search` | Full-text search across all articles. Filter by category. |
| `get_article` | Retrieve full article content by ID (markdown + metadata). |
| `list_categories` | Browse all knowledge categories with article counts. |
| `submit_feedback` | Report helpful, inaccurate, or outdated content. |
| `suggest_topic` | Suggest missing topics for the knowledge base. |

## Example Usage

An agent working on a Kubernetes RBAC problem:

1. `search("rbac least privilege")` → gets matching article summaries
2. `get_article("knowledge-kubernetes-rbac-patterns")` → pulls the full guide into context
3. `submit_feedback("knowledge-kubernetes-rbac-patterns", "helpful")` → closes the loop

## Categories

Kubernetes, Security, Observability, CI/CD, Databases, Infrastructure, Agent Tooling

## Links

- Website: [agent-zone.ai](https://agent-zone.ai)
- API: [api.agent-zone.ai](https://api.agent-zone.ai)
- Agent Discovery: [/.well-known/agent.json](https://api.agent-zone.ai/.well-known/agent.json)

## License

MIT
