import type { AgentExecutionContext } from '@ensemble-edge/conductor';

interface MiddlewareRequestResult {
	message: string;
	method: string;
	path: string;
	timestamp: string;
	middlewareApplied: string[];
}

export default function processMiddlewareRequest(
	context: AgentExecutionContext
): MiddlewareRequestResult {
	const { metadata, request } = context as any;

	return {
		message: 'Middleware demo successful!',
		method: request?.method || metadata?.method || 'GET',
		path: request?.url ? new URL(request.url).pathname : metadata?.path || '/api/demo',
		timestamp: new Date().toISOString(),
		middlewareApplied: [
			'logger - request logged',
			'compress - response will be compressed',
			'timing - Server-Timing header added',
			'secure-headers - security headers added',
			'etag - ETag header added',
		],
	};
}
