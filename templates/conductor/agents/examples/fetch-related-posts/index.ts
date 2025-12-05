import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default async function fetchRelatedPosts(context: AgentExecutionContext) {
	const input = context.input as { excludeId?: number };
	const excludeId = input.excludeId || 0;
	const db = (context.env as any).DB;

	if (!db) {
		return {
			rows: [
				{
					slug: 'getting-started',
					title: 'Getting Started',
					excerpt: 'Set up your first workflow',
				},
				{
					slug: 'ai-agents-guide',
					title: 'Building AI Agents',
					excerpt: 'Create intelligent agents',
				},
				{ slug: 'performance-tips', title: 'Performance Tips', excerpt: 'Best practices' },
			],
		};
	}

	const result = await db
		.prepare(
			`SELECT slug, title, excerpt FROM blog_posts WHERE id != ? AND published = true ORDER BY published_at DESC LIMIT 3`
		)
		.bind(excludeId)
		.all();

	return { rows: result.results || [] };
}
