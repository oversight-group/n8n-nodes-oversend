/**
 * Guards the load path itself.
 *
 * A previous release shipped `inputs: [NodeConnectionTypes.Main]`. On older n8n
 * installs that export does not exist, so reading `.Main` threw while the class
 * was constructed and n8n reported "Class could not be found. Please check if
 * the class is named correctly." — which points nowhere near the real cause.
 *
 * These tests assert the node and credential can be constructed even when
 * n8n-workflow lacks the newer export.
 */
describe('node loads under an older n8n-workflow', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.resetModules();
		jest.unmock('n8n-workflow');
	});

	it('constructs when NodeConnectionTypes is absent', () => {
		jest.doMock('n8n-workflow', () => {
			const actual = jest.requireActual('n8n-workflow');
			return { ...actual, NodeConnectionTypes: undefined };
		});

		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { OverSend } = require('../nodes/OverSend/OverSend.node');
		const node = new OverSend();

		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
	});

	it('constructs normally when NodeConnectionTypes is present', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { OverSend } = require('../nodes/OverSend/OverSend.node');
		const node = new OverSend();

		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
	});
});

describe('class names match what n8n derives from the filenames', () => {
	it('OverSend.node.js exports a class named OverSend', () => {
		// n8n strips ".node" from the filename and instantiates that export.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = require('../nodes/OverSend/OverSend.node');
		expect(typeof mod.OverSend).toBe('function');
		expect(() => new mod.OverSend()).not.toThrow();
	});

	it('OverSendApi.credentials.js exports a class named OverSendApi', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = require('../credentials/OverSendApi.credentials');
		expect(typeof mod.OverSendApi).toBe('function');
		expect(() => new mod.OverSendApi()).not.toThrow();
	});

	// Task 12 turns this back into an it() once the trigger node exists:
	// const mod = require('../nodes/OverSendTrigger/OverSendTrigger.node');
	// expect(typeof mod.OverSendTrigger).toBe('function');
	// expect(() => new mod.OverSendTrigger()).not.toThrow();
	it.todo('OverSendTrigger.node.js exports a class named OverSendTrigger');
});
