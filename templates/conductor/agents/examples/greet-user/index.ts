import type { AgentExecutionContext } from '@ensemble-edge/conductor';

interface GreetingResponse {
	greeting: string;
	timestamp: string;
	message: string;
}

export default function greetUser(context: AgentExecutionContext): GreetingResponse {
	const name =
		(context.request as any)?.params?.name || (context.input as any)?.name || 'World';

	return {
		greeting: `Hello, ${name}!`,
		timestamp: new Date().toISOString(),
		message: 'Welcome to Conductor!',
	};
}
