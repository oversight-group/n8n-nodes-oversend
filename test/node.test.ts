import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { OverSend } from '../nodes/OverSend/OverSend.node';
import { HANDLERS } from '../nodes/OverSend/operations/registry';
import { fakeExecute, httpError } from './helpers';

const node = new OverSend();
const props = node.description.properties;

describe('OverSend node description', () => {
	it('declares the credential, one input and output, tool use and two icons', () => {
		expect(node.description.name).toBe('overSend');
		expect(node.description.credentials).toEqual([{ name: 'overSendApi', required: true }]);
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toEqual(['main']);
		expect(node.description.icon).toEqual({ light: 'file:oversend.svg', dark: 'file:oversend.dark.svg' });
	});

	it('has a handler for every operation it shows, and shows every handler', () => {
		const resources = (props.find((p) => p.name === 'resource')!.options as INodePropertyOptions[]).map((o) => o.value as string);
		const shown = new Set<string>();
		for (const p of props.filter((p) => p.name === 'operation')) {
			const resource = (p.displayOptions!.show!.resource as string[])[0];
			for (const o of p.options as INodePropertyOptions[]) shown.add(`${resource}.${o.value as string}`);
			expect(p.options!.every((o) => typeof (o as INodePropertyOptions).action === 'string')).toBe(true);
		}
		const handled = new Set(Object.entries(HANDLERS).flatMap(([r, ops]) => Object.keys(ops).map((o) => `${r}.${o}`)));
		expect([...shown].sort()).toEqual([...handled].sort());
		expect(new Set([...shown].map((s) => s.split('.')[0]))).toEqual(new Set(resources));
	});

	it('registers every method the descriptions reference', () => {
		const loadOptions = new Set<string>();
		const listSearch = new Set<string>();
		const walk = (list: INodeProperties[]) => {
			for (const p of list) {
				const method = (p.typeOptions as { loadOptionsMethod?: string } | undefined)?.loadOptionsMethod;
				if (method) loadOptions.add(method);
				for (const mode of p.modes ?? []) {
					const search = (mode.typeOptions as { searchListMethod?: string } | undefined)?.searchListMethod;
					if (search) listSearch.add(search);
				}
				for (const o of p.options ?? []) if ('values' in o) walk(o.values as INodeProperties[]);
				for (const o of p.options ?? []) if ('type' in o && 'name' in o && 'displayName' in o) walk([o as INodeProperties]);
			}
		};
		walk(props);
		for (const m of loadOptions) expect(Object.keys(node.methods.loadOptions)).toContain(m);
		for (const m of listSearch) expect(Object.keys(node.methods.listSearch)).toContain(m);
		expect(Object.keys(node.methods.resourceMapping)).toContain('getTemplateFields');
	});
});

describe('execute', () => {
	it('runs the handler for each item and pairs the output', async () => {
		const { ctx, calls } = fakeExecute({ resource: 'instance', operation: 'getStatus' }, () => ({ status: 'connected' }), { items: 2 });
		const [out] = await node.execute.call(ctx);
		expect(out).toEqual([
			{ json: { status: 'connected' }, pairedItem: { item: 0 } },
			{ json: { status: 'connected' }, pairedItem: { item: 1 } },
		]);
		expect(calls).toHaveLength(2);
	});

	it('continues on fail with the error message', async () => {
		const { ctx } = fakeExecute({ resource: 'instance', operation: 'getStatus' }, () => {
			throw httpError(401, { error: 'invalid_api_key' });
		}, { continueOnFail: true });
		const [out] = await node.execute.call(ctx);
		expect(out).toEqual([{ json: { error: 'OverSend: invalid_api_key' }, pairedItem: { item: 0 } }]);
	});

	it('names an unknown operation', async () => {
		const { ctx } = fakeExecute({ resource: 'message', operation: 'teleport' });
		await expect(node.execute.call(ctx)).rejects.toThrow('Unknown operation "message.teleport"');
	});
});
