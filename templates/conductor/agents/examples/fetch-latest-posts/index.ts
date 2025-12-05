import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default async function fetchLatestPosts(context: AgentExecutionContext) {
	const db = (context.env as any).DB;

	if (!db) {
		return {
			rows: [
				{
					slug: 'getting-started',
					title: 'Getting Started with Conductor',
					excerpt: 'Set up your first workflow',
					published_at: '2024-11-20',
				},
				{
					slug: 'ai-agents-guide',
					title: 'Building AI Agents',
					excerpt: 'Create intelligent agents',
					published_at: '2024-11-18',
				},
				{
					slug: 'performance-tips',
					title: 'Performance Tips',
					excerpt: 'Best practices',
					published_at: '2024-11-15',
				},
			],
		};
	}

	const result = await db
		.prepare(
			`SELECT slug, title, excerpt, published_at FROM blog_posts WHERE published = true ORDER BY published_at DESC LIMIT 3`
		)
		.all();

	return { rows: result.results || [] };
}
