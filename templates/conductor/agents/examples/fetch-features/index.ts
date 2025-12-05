import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default async function fetchFeatures(context: AgentExecutionContext) {
	const db = (context.env as any).DB;

	if (!db) {
		return {
			rows: [
				{ icon: '🚀', title: 'Lightning Fast', description: 'Execute workflows at the edge' },
				{ icon: '🔧', title: 'Easy Configuration', description: 'Define workflows with YAML' },
				{ icon: '🤖', title: 'AI Native', description: 'Built-in AI model support' },
				{ icon: '🔗', title: 'Seamless Integration', description: 'Connect to any API' },
				{ icon: '📊', title: 'Real-time Analytics', description: 'Monitor workflows in real-time' },
				{ icon: '🔒', title: 'Enterprise Security', description: 'SOC2 compliant' },
			],
		};
	}

	const result = await db
		.prepare(
			`SELECT icon, title, description FROM featured_items WHERE active = true ORDER BY sort_order LIMIT 6`
		)
		.all();

	return { rows: result.results || [] };
}
