# agent-zone-mcp

Infrastructure Knowledge MCP Server

[![npm version](https://img.shields.io/npm/v/agent-zone-mcp.svg)](https://www.npmjs.com/package/agent-zone-mcp)
[![npm downloads](https://img.shields.io/npm/dm/agent-zone-mcp.svg)](https://www.npmjs.com/package/agent-zone-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Smithery](https://smithery.ai/badge/@statherm/agent-zone-mcp)](https://smithery.ai/server/@statherm/agent-zone-mcp)

MCP server for [Agent Zone](https://agent-zone.ai) — vendor-neutral infrastructure knowledge, K8s validation, and execution templates for AI agents.

Search 200+ articles, validate K8s manifests, get structured playbooks, and discover the right validation path for your infrastructure work. Free, no API key required.

## Features

- **200+ infrastructure articles** — Kubernetes, networking, observability, CI/CD, disaster recovery, security, multi-region patterns
- **10 MCP tools** — search, validate, get templates and playbooks, submit feedback
- **K8s manifest validation** — 5 built-in policy checks (resource limits, health probes, security, labels, image tags)
- **5 validation paths** — from static analysis (~40% detection) to cloud ephemeral (~98%)
- **19 infrastructure templates** — searchable by path, tags, and query with download support
- **6 structured playbooks** — step-by-step operational guidance filtered by validation path
- **Vendor-neutral** — not tied to any cloud provider
- **Free, no API key** — works out of the box

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

### Streamable HTTP

For clients that support HTTP transport directly:

```
https://api.agent-zone.ai/mcp
```

## Tools

### Knowledge

| Tool | Description |
|---|---|
| `search` | Full-text search across all articles. Filter by category. |
| `get_article` | Retrieve full article content by ID (markdown + metadata). |
| `list_categories` | Browse all knowledge categories with article counts. |
| `submit_feedback` | Report helpful, inaccurate, or outdated content. |
| `suggest_topic` | Suggest missing topics for the knowledge base. |

### Templates & Playbooks

| Tool | Description |
|---|---|
| `list_templates` | Search/filter infrastructure templates by validation path, tags, or query. |
| `get_template` | Get full template metadata including requirements and produces. |
| `get_playbook` | Get a structured step-by-step playbook, optionally filtered by validation path. |

### Validation

| Tool | Description |
|---|---|
| `select_validation_path` | Describe your resources and needs, get the right validation path + templates + playbook. |
| `validate` | Submit K8s manifests or Helm values, get policy validation results back. |

## How It Works

This is a stdio-based MCP server that wraps the [Agent Zone REST API](https://api.agent-zone.ai). The npm package runs locally and communicates with `api.agent-zone.ai` over HTTPS. No API key, no account, no local database — just install and use.

A Streamable HTTP endpoint is also available at `https://api.agent-zone.ai/mcp` for clients that support remote MCP servers directly.

## Example: End-to-End Validation Flow

An agent needs to test a Helm chart and has Docker with 8GB RAM:

1. `select_validation_path({work_type: "helm-chart", available_resources: ["docker"], resource_specs: {memory_mb: 8192}})` → recommends Path 3 (minikube) with matching templates and the `validate-helm-chart` playbook

2. `list_templates({path: 3, query: "minikube"})` → finds setup templates

3. `get_template({id: "local-full~minikube~profiles"})` → gets requirements and setup details

4. `get_playbook({id: "validate-helm-chart", path: 3})` → structured steps with commands and success criteria

5. `validate({type: "k8s-manifest", content: "apiVersion: apps/v1\nkind: Deployment..."})` → instant policy checks (resource limits, health probes, security, labels)

## Validation Paths

| Path | Name | Requirements | Detection Rate |
|---|---|---|---|
| 1 | Static Analysis | None | ~40% |
| 2 | Local Lightweight | Docker | ~75% |
| 3 | Local Full-Fidelity | Docker + 4GB+ RAM | ~90% |
| 4 | Cloud Ephemeral | Cloud account | ~98% |
| 5 | Free-Tier Cloud | Codespaces/free tier | ~85% |

## Policy Checks

The `validate` tool checks K8s manifests against 5 policies:

- **require-resource-limits** — CPU and memory limits on all containers
- **require-health-checks** — liveness and readiness probes
- **no-latest-tag** — pinned image tags (no `:latest` or missing tag)
- **no-privileged** — no privileged mode, root user, or privilege escalation
- **require-labels** — standard `app.kubernetes.io/name` and `app.kubernetes.io/version` labels

## Links

- [npm](https://www.npmjs.com/package/agent-zone-mcp)
- [Smithery](https://smithery.ai/server/@statherm/agent-zone-mcp)
- [Website](https://agent-zone.ai)
- [API](https://api.agent-zone.ai)
- [Agent Discovery](https://api.agent-zone.ai/.well-known/agent.json)

## License

MIT
