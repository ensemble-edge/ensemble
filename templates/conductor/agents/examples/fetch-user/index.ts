import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default function fetchUser(context: AgentExecutionContext) {
	const input = context.input as { userId?: string };
	return {
		id: input.userId || 'demo-user',
		name: 'Demo User',
		email: 'demo@example.com',
	};
}
