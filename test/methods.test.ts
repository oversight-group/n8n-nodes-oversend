import { listSearch } from '../nodes/OverSend/methods/listSearch';
import { loadOptions } from '../nodes/OverSend/methods/loadOptions';
import { resourceMapping } from '../nodes/OverSend/methods/resourceMapping';
import { fakeLoadOptions } from './helpers';

const chats = {
	chats: [
		{ id: 'g1', type: 'group', name: 'Team', phone: null },
		{ id: 'd1', type: 'direct', name: 'Dana', phone: '972501234567' },
		{ id: 'd2', type: 'direct', name: null, phone: '972527654321' },
	],
	nextCursor: 'next',
};

describe('chat search', () => {
	it('searches all chats, labels groups and people, and passes the cursor on', async () => {
		const { ctx, calls } = fakeLoadOptions({}, () => chats);
		const result = await listSearch.searchChats.call(ctx, '  Da  ', 'c1');
		expect(calls[0].qs).toEqual({ q: 'Da', limit: 50, cursor: 'c1' });
		expect(result).toEqual({
			results: [
				{ name: 'Team (group)', value: 'g1' },
				{ name: 'Dana (+972501234567)', value: 'd1' },
				{ name: '+972527654321', value: 'd2' },
			],
			paginationToken: 'next',
		});
	});

	it('limits the group search to groups, sends no empty query, and caps it at 100 characters', async () => {
		const { ctx, calls } = fakeLoadOptions({}, () => ({ chats: [], nextCursor: null }));
		const result = await listSearch.searchGroups.call(ctx, '   ');
		expect(calls[0].qs).toEqual({ type: 'group', limit: 50 });
		expect(result).toEqual({ results: [], paginationToken: undefined });
		await listSearch.searchGroups.call(ctx, 'x'.repeat(150));
		expect((calls[1].qs?.q as string).length).toBe(100);
	});
});

describe('dropdowns', () => {
	it('lists labels and members', async () => {
		const { ctx } = fakeLoadOptions({}, (call) =>
			call.url.endsWith('/labels')
				? { labels: [{ id: 'l1', name: 'VIP', color: 'red' }] }
				: { members: [{ id: 'm1', name: 'Noa', email: 'noa@x.test', role: 'agent', pending: false }] },
		);
		expect(await loadOptions.getLabels.call(ctx)).toEqual([{ name: 'VIP', value: 'l1' }]);
		expect(await loadOptions.getMembers.call(ctx)).toEqual([{ name: 'Noa', value: 'm1', description: 'noa@x.test' }]);
		expect(await loadOptions.getMembersOrNone.call(ctx)).toEqual([
			{ name: 'Unassigned', value: 'none' },
			{ name: 'Noa', value: 'm1', description: 'noa@x.test' },
		]);
	});

	it('lists templates with values that carry their type', async () => {
		const { ctx } = fakeLoadOptions({}, () => ({
			templates: [
				{ type: 'meta', name: 'order_ready', language: 'he', category: 'UTILITY', needs: {} },
				{ type: 'quick', name: 'welcome', title: 'Welcome', body: '', placeholders: [], file: null },
			],
		}));
		expect(await loadOptions.getTemplates.call(ctx)).toEqual([
			{ name: 'order_ready (he)', value: 'meta|he|order_ready', description: 'UTILITY' },
			{ name: 'Welcome', value: 'quick||welcome', description: 'welcome' },
		]);
	});
});

describe('template fields', () => {
	it("maps the chosen template's needs", async () => {
		const { ctx } = fakeLoadOptions({ template: 'meta|he|order_ready' }, () => ({
			templates: [{ type: 'meta', name: 'order_ready', language: 'he', category: 'UTILITY', needs: { header: { type: 'none' }, bodyParams: 1, buttons: [], code: false } }],
		}));
		expect((await resourceMapping.getTemplateFields.call(ctx)).fields.map((f) => f.id)).toEqual(['body_1']);
	});

	it('maps nothing before a template is chosen, or when it is gone', async () => {
		expect((await resourceMapping.getTemplateFields.call(fakeLoadOptions({}).ctx)).fields).toEqual([]);
		const gone = fakeLoadOptions({ template: 'meta|he|old' }, () => ({ templates: [] }));
		expect((await resourceMapping.getTemplateFields.call(gone.ctx)).fields).toEqual([]);
	});
});
