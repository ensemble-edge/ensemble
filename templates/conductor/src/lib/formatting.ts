/**
 * Shared Utility Functions
 *
 * These utilities can be imported and used across your agents.
 * Example: import { formatMessage, sanitizeInput } from '../../lib/formatting';
 */

/**
 * Format a greeting message with timestamp
 * @param message - The greeting message
 * @param includeTimestamp - Whether to include a timestamp
 * @returns Formatted message
 */
export function formatMessage(message: string, includeTimestamp = false): string {
	if (includeTimestamp) {
		const now = new Date().toISOString();
		return `[${now}] ${message}`;
	}
	return message;
}

/**
 * Sanitize user input by removing potentially harmful characters
 * @param input - Raw user input
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
	return input
		.trim()
		.replace(/[<>]/g, '') // Remove angle brackets
		.slice(0, 1000); // Limit length
}

/**
 * Capitalize first letter of a string
 * @param str - Input string
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Get time-based greeting prefix
 * @param hour - Hour in 24-hour format (0-23)
 * @returns Greeting prefix like "Good morning"
 */
export function getTimeBasedGreeting(hour: number = new Date().getHours()): string {
	if (hour >= 5 && hour < 12) return 'Good morning';
	if (hour >= 12 && hour < 17) return 'Good afternoon';
	if (hour >= 17 && hour < 22) return 'Good evening';
	return 'Good evening';
}

/**
 * Parse greeting style from config
 * @param config - Config object
 * @param style - Requested style
 * @returns Style configuration
 */
export function getStyleConfig(config: Record<string, unknown>, style: string): Record<string, unknown> {
	const styles = config?.styles as Record<string, unknown> | undefined;
	const defaults = config?.defaults as Record<string, unknown> | undefined;
	const defaultStyle = defaults?.style as string | undefined;

	return (styles?.[style] as Record<string, unknown>) ||
	       (defaultStyle && styles?.[defaultStyle] as Record<string, unknown>) ||
	       {};
}
