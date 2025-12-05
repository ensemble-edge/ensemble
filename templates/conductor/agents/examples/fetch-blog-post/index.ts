import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default async function fetchBlogPost(context: AgentExecutionContext) {
	const input = context.input as { slug?: string };
	const slug = input.slug;

	if (!slug) return { post: null, found: false };

	const db = (context.env as any).DB;

	if (!db) {
		return {
			post: {
				id: 1,
				slug,
				title: 'Sample Blog Post',
				content: `Sample content for: ${slug}`,
				excerpt: 'A sample blog post.',
				author: 'Conductor Team',
				cover_image: null,
				published_at: '2024-11-20T10:00:00Z',
				reading_time: 5,
				tags: '["tutorial"]',
			},
			found: true,
		};
	}

	const result = await db
		.prepare(
			`SELECT id, slug, title, content, excerpt, author, cover_image, published_at, reading_time, tags FROM blog_posts WHERE slug = ? AND published = true LIMIT 1`
		)
		.bind(slug)
		.first();

	return result ? { post: result, found: true } : { post: null, found: false };
}
