#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export function createServer(apiBase = "https://api.agent-zone.ai"): McpServer {
	async function apiFetch(path: string): Promise<unknown> {
		const res = await fetch(`${apiBase}${path}`, {
			headers: { "User-Agent": "agent-zone-mcp/0.1.0" },
		});
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`API ${res.status}: ${body}`);
		}
		return res.json();
	}

	const server = new McpServer({
		name: "agent-zone",
		version: "0.1.0",
	});

	server.tool(
		"search",
		"Search Agent Zone knowledge base for infrastructure articles. Returns matching article titles, descriptions, and IDs. Use get_article to retrieve full content.",
		{
			query: z.string().describe("Search query (e.g. 'kubernetes rbac', 'helm naming', 'prometheus alerting')"),
			category: z.string().optional().describe("Filter by category (e.g. 'kubernetes', 'security', 'observability')"),
			limit: z.number().min(1).max(50).default(10).describe("Max results to return"),
		},
		async ({ query, category, limit }) => {
			const params = new URLSearchParams({ q: query, limit: String(limit) });
			if (category) params.set("category", category);

			const data = (await apiFetch(`/api/v1/knowledge/search?${params}`)) as {
				query: string;
				count: number;
				results: Array<{
					id: string;
					title: string;
					description: string;
					url: string;
					categories: string[];
					tags: string[];
					skills: string[];
				}>;
			};

			if (data.count === 0) {
				return {
					content: [{ type: "text" as const, text: `No results found for "${query}".` }],
				};
			}

			const text = data.results
				.map(
					(r, i) =>
						`${i + 1}. **${r.title}**\n   ID: \`${r.id}\`\n   ${r.description}\n   Categories: ${(r.categories || []).join(", ")} | Tags: ${(r.tags || []).join(", ")}`,
				)
				.join("\n\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Found ${data.count} results for "${query}":\n\n${text}\n\nUse get_article with an article ID to retrieve full content.`,
					},
				],
			};
		},
	);

	server.tool(
		"get_article",
		"Retrieve the full content of an Agent Zone article by its ID. Returns the complete article with markdown content, metadata, categories, tags, and skills.",
		{
			id: z.string().describe("Article ID (from search results, e.g. 'knowledge-kubernetes-rbac-patterns')"),
		},
		async ({ id }) => {
			try {
				const data = (await apiFetch(`/api/v1/knowledge/${id}?format=agent`)) as {
					id: string;
					title: string;
					description: string;
					content: string;
					metadata: {
						section: string;
						categories: string[];
						tags: string[];
						skills: string[];
						tools: string[];
						word_count: number;
					};
				};

				const header = [
					`# ${data.title}`,
					"",
					data.description,
					"",
					`**Categories:** ${(data.metadata.categories || []).join(", ")}`,
					`**Tags:** ${(data.metadata.tags || []).join(", ")}`,
					`**Skills:** ${(data.metadata.skills || []).join(", ")}`,
					`**Tools:** ${(data.metadata.tools || []).join(", ")}`,
					`**Word count:** ${data.metadata.word_count}`,
					"",
					"---",
					"",
				].join("\n");

				return {
					content: [{ type: "text" as const, text: header + (data.content || "No content available.") }],
				};
			} catch {
				return {
					content: [{ type: "text" as const, text: `Article "${id}" not found.` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"list_categories",
		"List all knowledge categories available in Agent Zone with article counts. Useful for discovering what topics are covered.",
		{},
		async () => {
			const data = (await apiFetch("/api/v1/knowledge/categories")) as {
				categories: Array<{ name: string; count: number }>;
			};

			const text = data.categories
				.map((c) => `- **${c.name}** (${c.count} articles)`)
				.join("\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Agent Zone Knowledge Categories:\n\n${text}\n\nUse search with a category filter to find articles in a specific category.`,
					},
				],
			};
		},
	);

	server.tool(
		"submit_feedback",
		"Submit feedback on an Agent Zone article. Use this to report helpful content, inaccuracies, outdated information, or suggest improvements.",
		{
			content_id: z.string().describe("Article ID to give feedback on"),
			feedback_type: z.enum(["helpful", "inaccurate", "outdated", "needs-examples", "other"]).describe("Type of feedback"),
			comment: z.string().max(1000).optional().describe("Optional comment with details"),
		},
		async ({ content_id, feedback_type, comment }) => {
			try {
				const res = await fetch(`${apiBase}/api/v1/feedback`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"User-Agent": "agent-zone-mcp/0.1.0",
					},
					body: JSON.stringify({ content_id, feedback_type, comment }),
				});
				const data = (await res.json()) as { id?: string; error?: string };

				if (!res.ok) {
					return {
						content: [{ type: "text" as const, text: `Feedback failed: ${data.error}` }],
						isError: true,
					};
				}

				return {
					content: [{ type: "text" as const, text: `Feedback submitted (ID: ${data.id}). Thank you!` }],
				};
			} catch (e) {
				return {
					content: [{ type: "text" as const, text: `Failed to submit feedback: ${e}` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"suggest_topic",
		"Suggest a new topic or article for Agent Zone. Use this when you notice a gap in the knowledge base that would be useful for infrastructure work.",
		{
			title: z.string().min(3).max(200).describe("Suggested topic title"),
			description: z.string().min(10).max(2000).describe("Why this topic would be useful, what it should cover"),
			related_content_id: z.string().optional().describe("ID of a related existing article, if any"),
		},
		async ({ title, description, related_content_id }) => {
			try {
				const res = await fetch(`${apiBase}/api/v1/suggestions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"User-Agent": "agent-zone-mcp/0.1.0",
					},
					body: JSON.stringify({ title, description, related_content_id }),
				});
				const data = (await res.json()) as { id?: string; error?: string };

				if (!res.ok) {
					return {
						content: [{ type: "text" as const, text: `Suggestion failed: ${data.error}` }],
						isError: true,
					};
				}

				return {
					content: [{ type: "text" as const, text: `Topic suggested (ID: ${data.id}): "${title}" — status: pending. Thank you!` }],
				};
			} catch (e) {
				return {
					content: [{ type: "text" as const, text: `Failed to submit suggestion: ${e}` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"list_templates",
		"Search and list Agent Zone infrastructure templates. Templates are ready-to-use configurations for validation (Path 1), local testing (Paths 2-3), cloud testing (Path 4), and dev environments (Path 5).",
		{
			query: z.string().optional().describe("Search query (e.g. 'kubernetes', 'terraform', 'helm')"),
			path: z.number().min(1).max(5).optional().describe("Filter by validation path (1-5)"),
			tag: z.string().optional().describe("Filter by tag (e.g. 'kubernetes', 'docker', 'terraform')"),
			limit: z.number().min(1).max(100).default(25).describe("Max results"),
		},
		async ({ query, path, tag, limit }) => {
			try {
				const params = new URLSearchParams({ limit: String(limit) });
				if (query) params.set("q", query);
				if (path) params.set("path", String(path));
				if (tag) params.set("tag", tag);

				const data = (await apiFetch(`/api/v1/templates?${params}`)) as {
					count: number;
					results: Array<{
						id: string;
						name: string;
						description: string;
						validation_path: number;
						tags: string[];
						estimated_duration: string;
						estimated_cost: string;
					}>;
				};

				if (data.count === 0) {
					return {
						content: [{ type: "text" as const, text: "No templates found matching your criteria." }],
					};
				}

				const text = data.results
					.map(
						(r, i) =>
							`${i + 1}. **${r.name}** (Path ${r.validation_path})\n   ID: \`${r.id}\`\n   ${r.description}\n   Duration: ${r.estimated_duration} | Cost: ${r.estimated_cost} | Tags: ${(r.tags || []).join(", ")}`,
					)
					.join("\n\n");

				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${data.count} templates:\n\n${text}\n\nUse get_template with a template ID for full details.`,
						},
					],
				};
			} catch (e) {
				return {
					content: [{ type: "text" as const, text: `Failed to list templates: ${e}` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"get_template",
		"Get detailed metadata for a specific Agent Zone template by ID. Returns requirements, what it produces, estimated duration, cost, and tags.",
		{
			id: z.string().describe("Template ID (e.g. 'validation~helm-lint', 'local-full~minikube~scenarios~minimal-web')"),
		},
		async ({ id }) => {
			try {
				const data = (await apiFetch(`/api/v1/templates/${id}`)) as {
					id: string;
					name: string;
					description: string;
					validation_path: number;
					version: string;
					file_count: number;
					estimated_duration: string;
					estimated_cost: string;
					tags: string[];
					requirements: Record<string, unknown>;
					produces: string[];
				};

				const text = [
					`# ${data.name}`,
					"",
					data.description,
					"",
					`**ID:** \`${data.id}\``,
					`**Validation Path:** ${data.validation_path}`,
					`**Version:** ${data.version}`,
					`**Files:** ${data.file_count}`,
					`**Estimated Duration:** ${data.estimated_duration}`,
					`**Estimated Cost:** ${data.estimated_cost}`,
					`**Tags:** ${(data.tags || []).join(", ")}`,
					"",
					"**Requirements:**",
					"```json",
					JSON.stringify(data.requirements, null, 2),
					"```",
					"",
					"**Produces:**",
					...(data.produces || []).map((p: string) => `- ${p}`),
				].join("\n");

				return {
					content: [{ type: "text" as const, text }],
				};
			} catch {
				return {
					content: [{ type: "text" as const, text: `Template "${id}" not found.` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"select_validation_path",
		"Get recommended validation path based on what you need to validate and what resources you have. Returns a recommended path (1-5) with reasoning, matching templates, and a relevant playbook.",
		{
			work_type: z.string().describe("What to validate (helm-chart, terraform-plan, k8s-manifest, database-migration, network-policy, ci-cd-pipeline, kubernetes-upgrade)"),
			available_resources: z.array(z.string()).default([]).describe("Available resources (docker, cloud-account, aws, azure, gcp, codespace, gitpod)"),
			resource_specs: z.object({
				memory_mb: z.number().optional(),
				cpu_cores: z.number().optional(),
			}).default({}).describe("Resource details"),
			required_fidelity: z.string().default("full-deployment").describe("Desired fidelity level (syntax-check, dry-run, full-deployment)"),
		},
		async ({ work_type, available_resources, resource_specs, required_fidelity }) => {
			try {
				const res = await fetch(`${apiBase}/api/v1/advisor/select-path`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"User-Agent": "agent-zone-mcp/0.1.0",
					},
					body: JSON.stringify({ work_type, available_resources, resource_specs, required_fidelity }),
				});
				const data = (await res.json()) as {
					recommended_path: number;
					path_name: string;
					reasoning: string;
					issue_detection_rate: string;
					estimated_cost: string;
					templates: Array<{ id: string; name: string; description: string }>;
					playbook: { id: string; name: string; description: string; url: string } | null;
					alternative_paths: Array<{ path: number; name: string; trade_off: string }>;
					error?: string;
				};

				if (!res.ok) {
					return {
						content: [{ type: "text" as const, text: `Advisor error: ${data.error}` }],
						isError: true,
					};
				}

				const templateText = data.templates.length > 0
					? "\n\n**Templates:**\n" + data.templates.map(t => `- ${t.name}: ${t.description}`).join("\n")
					: "\n\nNo templates found for this path yet.";

				const playbookText = data.playbook
					? `\n\n**Playbook:** ${data.playbook.name}\n${data.playbook.description}\nURL: ${data.playbook.url}`
					: "";

				const altText = data.alternative_paths.length > 0
					? "\n\n**Alternatives:**\n" + data.alternative_paths.map(a => `- Path ${a.path} (${a.name}): ${a.trade_off}`).join("\n")
					: "";

				const text = [
					`**Recommended Path ${data.recommended_path}: ${data.path_name}**`,
					`Detection rate: ${data.issue_detection_rate} | Cost: ${data.estimated_cost}`,
					`\nReasoning: ${data.reasoning}`,
					templateText,
					playbookText,
					altText,
				].join("\n");

				return {
					content: [{ type: "text" as const, text }],
				};
			} catch (e) {
				return {
					content: [{ type: "text" as const, text: `Failed to get validation path: ${e}` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"get_playbook",
		"Get a structured validation playbook with step-by-step instructions. Playbooks provide ordered steps to validate infrastructure changes like Helm charts, database migrations, Kubernetes upgrades, and more.",
		{
			id: z.string().describe("Playbook ID (e.g. 'validate-helm-chart', 'test-database-migration', 'verify-kubernetes-upgrade')"),
			path: z.number().min(1).max(5).optional().describe("Filter steps to a specific validation path (1-5)"),
		},
		async ({ id, path }) => {
			try {
				const params = path ? `?path=${path}` : "";
				const data = (await apiFetch(`/api/v1/playbooks/${id}${params}`)) as {
					id: string;
					name: string;
					version: string;
					description: string;
					tier: string;
					inputs: Array<{ name: string; type: string; required: boolean; default?: string; description: string }>;
					steps: Array<{ name: string; paths: number[]; command?: string; template?: Record<string, string>; on_failure: string; severity: string }>;
					applicable_paths: number[];
					tags: string[];
				};

				const inputText = data.inputs && data.inputs.length > 0
					? "\n\n**Inputs:**\n" + data.inputs.map(i => `- \`${i.name}\` (${i.type}${i.required ? ", required" : ""}${i.default ? `, default: ${i.default}` : ""}): ${i.description}`).join("\n")
					: "";

				const stepsText = (data.steps || []).map((s, i) =>
					`${i + 1}. **${s.name}** [paths: ${s.paths.join(",")}] (${s.severity})\n   ${s.command ? `Command: \`${s.command}\`` : `Template: ${JSON.stringify(s.template)}`}\n   On failure: ${s.on_failure}`,
				).join("\n\n");

				const text = [
					`# ${data.name} (v${data.version})`,
					"",
					data.description,
					`\nTier: ${data.tier} | Paths: ${(data.applicable_paths || []).join(", ")} | Tags: ${(data.tags || []).join(", ")}`,
					inputText,
					`\n**Steps${path ? ` (filtered to path ${path})` : ""}:**\n`,
					stepsText,
				].join("\n");

				return {
					content: [{ type: "text" as const, text }],
				};
			} catch {
				return {
					content: [{ type: "text" as const, text: `Playbook "${id}" not found.` }],
					isError: true,
				};
			}
		},
	);

	server.tool(
		"validate",
		"Validate Kubernetes manifests or Helm values against schema and best-practice policies. Returns structured error/warning results.",
		{
			type: z.enum(["k8s-manifest", "helm-values"]).describe("What to validate"),
			content: z.string().describe("The YAML or JSON content to validate"),
		},
		async ({ type, content }) => {
			try {
				const endpoint = type === "k8s-manifest"
					? "/api/v1/validate/k8s-manifest"
					: "/api/v1/validate/helm-values";

				const res = await fetch(`${apiBase}${endpoint}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-yaml",
						"User-Agent": "agent-zone-mcp/0.1.0",
					},
					body: content,
				});
				const data = (await res.json()) as {
					status: string;
					errors: Array<{ resource: string; field: string; message: string; rule: string; severity: string }>;
					warnings: Array<{ resource: string; field: string; message: string; rule: string; severity: string }>;
					summary: { resources_checked: number; errors: number; warnings: number; passed: number };
					error?: string;
				};

				if (!res.ok) {
					return {
						content: [{ type: "text" as const, text: `Validation request failed: ${data.error || res.statusText}` }],
						isError: true,
					};
				}

				const lines = [`**Validation Result: ${data.status.toUpperCase()}**`, ""];
				lines.push(`Resources checked: ${data.summary.resources_checked} | Errors: ${data.summary.errors} | Warnings: ${data.summary.warnings} | Passed: ${data.summary.passed}`);

				if (data.errors.length > 0) {
					lines.push("", "**Errors:**");
					for (const e of data.errors) {
						lines.push(`- [${e.rule}] ${e.resource} \`${e.field}\`: ${e.message}`);
					}
				}
				if (data.warnings.length > 0) {
					lines.push("", "**Warnings:**");
					for (const w of data.warnings) {
						lines.push(`- [${w.rule}] ${w.resource} \`${w.field}\`: ${w.message}`);
					}
				}
				if (data.errors.length === 0 && data.warnings.length === 0) {
					lines.push("", "All checks passed.");
				}

				return {
					content: [{ type: "text" as const, text: lines.join("\n") }],
				};
			} catch (e) {
				return {
					content: [{ type: "text" as const, text: `Failed to validate: ${e}` }],
					isError: true,
				};
			}
		},
	);

	return server;
}

// Smithery sandbox scanning support
export function createSandboxServer(): McpServer {
	return createServer("https://api.agent-zone.ai");
}

// --- Start ---

async function main() {
	const apiBase = process.env.AGENT_ZONE_API_URL || "https://api.agent-zone.ai";
	const server = createServer(apiBase);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main();
