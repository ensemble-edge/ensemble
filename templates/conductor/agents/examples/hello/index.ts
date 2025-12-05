/**
 * Greet Agent - Function Type
 *
 * A simple greeting function that demonstrates:
 * - Using shared utilities from src/lib/
 * - Input validation and sanitization
 * - Style-based message selection
 * - Custom output formatting
 *
 * This function agent doesn't require AI models or external services,
 * making it perfect for testing and learning the Conductor workflow.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor';
import { sanitizeInput, formatMessage } from '../../../src/lib/formatting';
export default async function greet({ input }: AgentExecutionContext) {
	// Sanitize user input using shared utility
	const name = sanitizeInput(input.name || 'World');
	const style = input.style || 'friendly';

	// Generate greeting based on style
	let message = '';
	if (style === 'formal') {
		message = `Good day, ${name}. It's a pleasure to meet you.`;
	} else if (style === 'casual') {
		message = `Hey ${name}! Great to see you!`;
	} else {
		message = `Hello, ${name}! Welcome to Conductor.`;
	}

	// Format message using shared utility
	const formattedMessage = formatMessage(message, false);

	return {
		message: formattedMessage
	};
}
