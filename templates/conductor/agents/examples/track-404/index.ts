import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default async function track404(context: AgentExecutionContext) {
	const input = context.input as { requestedPath?: string; referrer?: string; userAgent?: string };
	const db = (context.env as any).DB;

	if (!db) {
		console.log('[track-404] D1 not available, skipping');
		return { tracked: false };
	}

	try {
		await db
			.prepare(
				`INSERT INTO error_404_logs (requested_path, referrer, user_agent) VALUES (?, ?, ?)`
			)
			.bind(input.requestedPath || 'unknown', input.referrer || null, input.userAgent || null)
			.run();
		return { tracked: true };
	} catch (error) {
		console.error('[track-404] Failed:', error);
		return { tracked: false };
	}
}
