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
