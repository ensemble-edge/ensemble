import { describe, it, expect, beforeEach } from 'vitest';
import { TestConductor } from '@ensemble-edge/conductor/testing';

describe('Debug TestConductor', () => {
	let conductor: TestConductor;

	beforeEach(async () => {
		conductor = await TestConductor.create({
			projectPath: '.'
		});
	});

	it('should load agents', async () => {
		// @ts-expect-error - accessing private catalog for debugging
		const agents = conductor.catalog.agents;
		console.log('Loaded agents:', Array.from(agents.keys()));
		console.log('Members size:', agents.size);

		// Try to get greet agent
		// @ts-expect-error - accessing private method
		const greetMember = conductor.catalog.agents.get('hello');
		console.log('Greet agent:', greetMember);

		expect(agents.size).toBeGreaterThan(0);
	});
});
