import { chatHandlers } from '../nodes/OverSend/operations/chat';
import { contactHandlers } from '../nodes/OverSend/operations/contact';
import { noteHandlers } from '../nodes/OverSend/operations/note';
import { scheduledMessageHandlers } from '../nodes/OverSend/operations/scheduledMessage';
import { instanceHandlers, labelHandlers, memberHandlers, templateHandlers } from '../nodes/OverSend/operations/simple';
import { unsubscribeHandlers } from '../nodes/OverSend/operations/unsubscribe';
import { fakeExecute, rl } from './helpers';

const base = 'https://api.example.test/v1';

describe('chats', () => {
	it('gets one and many', async () => {
		const one = fakeExecute({ chatId: rl('c1') }, () => ({ id: 'c1' }));
		await chatHandlers.get(one.ctx, 0);
		expect(one.calls[0].url).toBe(`${base}/chats/c1`);

		const many = fakeExecute(
			{ returnAll: false, limit: 5, filters: { type: 'group', search: ' team ', status: 'open', assigneeId: 'none', labelId: 'l1' } },
			() => ({ chats: [{ id: 'g1' }], nextCursor: null }),
		);
		expect((await chatHandlers.getMany(many.ctx, 0)).map((i) => i.json.id)).toEqual(['g1']);
		expect(many.calls[0].qs).toEqual({ type: 'group', q: 'team', status: 'open', assigneeId: 'none', labelId: 'l1', limit: 5 });
	});

	it('updates only the fields given, with unassign and clear snooze', async () => {
		const { ctx, calls } = fakeExecute(
			{ chatId: rl('c1'), updateFields: { status: 'done', assigneeId: 'none', pinned: false, clearSnooze: true, markUnread: true } },
			() => ({ id: 'c1' }),
		);
		await chatHandlers.update(ctx, 0);
		expect(calls[0]).toMatchObject({ method: 'PATCH', url: `${base}/chats/c1` });
		expect(calls[0].body).toEqual({ status: 'done', assigneeId: null, pinned: false, snoozedUntil: null, unread: true });
	});

	it('refuses an update with nothing to change', async () => {
		const { ctx } = fakeExecute({ chatId: rl('c1'), updateFields: {} });
		await expect(chatHandlers.update(ctx, 0)).rejects.toThrow('Add at least one field');
	});

	it('sets labels and marks read', async () => {
		const labels = fakeExecute({ chatId: rl('c1'), labelIds: ['l1', 'l2'] }, () => ({ id: 'c1' }));
		await chatHandlers.setLabels(labels.ctx, 0);
		expect(labels.calls[0]).toMatchObject({ method: 'PUT', url: `${base}/chats/c1/labels`, body: { labelIds: ['l1', 'l2'] } });
		const read = fakeExecute({ chatId: rl('c1') }, () => ({ id: 'c1' }));
		await chatHandlers.markRead(read.ctx, 0);
		expect(read.calls[0]).toMatchObject({ method: 'POST', url: `${base}/chats/c1/read` });
	});
});

describe('notes', () => {
	it('creates, lists, edits and deletes', async () => {
		const create = fakeExecute({ chatId: rl('c1'), body: 'Called back' }, () => ({ id: 'n1' }));
		await noteHandlers.create(create.ctx, 0);
		expect(create.calls[0]).toMatchObject({ method: 'POST', url: `${base}/chats/c1/notes`, body: { body: 'Called back' } });

		const list = fakeExecute({ chatId: rl('c1') }, () => ({ notes: [{ id: 'n1' }, { id: 'n2' }] }));
		expect(await noteHandlers.getMany(list.ctx, 0)).toHaveLength(2);

		const update = fakeExecute({ chatId: rl('c1'), noteId: 'n1', body: 'x' }, () => ({ id: 'n1' }));
		await noteHandlers.update(update.ctx, 0);
		expect(update.calls[0]).toMatchObject({ method: 'PATCH', url: `${base}/chats/c1/notes/n1` });

		const del = fakeExecute({ chatId: rl('c1'), noteId: 'n1' }, () => '');
		expect((await noteHandlers.delete(del.ctx, 0))[0].json).toEqual({ success: true });
		expect(del.calls[0]).toMatchObject({ method: 'DELETE', url: `${base}/chats/c1/notes/n1` });
	});
});

describe('scheduled messages', () => {
	it('gets, lists and cancels', async () => {
		const many = fakeExecute({ filterChatId: rl('c1'), status: 'all', returnAll: true }, () => ({ scheduled: [{ id: 's1' }], nextCursor: null }));
		await scheduledMessageHandlers.getMany(many.ctx, 0);
		expect(many.calls[0]).toMatchObject({ url: `${base}/scheduled-messages`, qs: { chatId: 'c1', status: 'all', limit: 100 } });
		const cancel = fakeExecute({ scheduledId: 's1' }, () => ({ id: 's1', status: 'cancelled' }));
		await scheduledMessageHandlers.cancel(cancel.ctx, 0);
		expect(cancel.calls[0]).toMatchObject({ method: 'DELETE', url: `${base}/scheduled-messages/s1` });
		const get = fakeExecute({ scheduledId: 's1' }, () => ({ id: 's1' }));
		await scheduledMessageHandlers.get(get.ctx, 0);
		expect(get.calls[0].url).toBe(`${base}/scheduled-messages/s1`);
	});
});

describe('contacts', () => {
	it('checks numbers 20 at a time, one item per number', async () => {
		const phones = Array.from({ length: 45 }, (_, n) => `9725000000${String(n).padStart(2, '0')}`).join('\n');
		const { ctx, calls } = fakeExecute({ phones }, (call) => ({
			results: (call.body as { phones: string[] }).phones.map((p) => ({ input: p, onWhatsApp: true })),
		}));
		const items = await contactHandlers.check(ctx, 0);
		expect(calls.map((c) => (c.body as { phones: string[] }).phones.length)).toEqual([20, 20, 5]);
		expect(items).toHaveLength(45);
	});
});

describe('unsubscribes', () => {
	it('adds, lists and removes', async () => {
		const add = fakeExecute({ phones: '972501234567, 972527654321', note: 'Asked by email' }, () => ({ added: 2, already: 0, invalid: [] }));
		await unsubscribeHandlers.add(add.ctx, 0);
		expect(add.calls[0].body).toEqual({ phones: ['972501234567', '972527654321'], note: 'Asked by email' });

		const list = fakeExecute({ returnAll: false, limit: 300, filters: { phone: '972501234567' } }, () => ({ unsubscribes: [], nextCursor: null }));
		await unsubscribeHandlers.getMany(list.ctx, 0);
		expect(list.calls[0].qs).toEqual({ phone: '972501234567', limit: 200 });

		const remove = fakeExecute({ phone: '+972 50-123-4567' }, () => '');
		expect((await unsubscribeHandlers.remove(remove.ctx, 0))[0].json).toEqual({ success: true });
		expect(remove.calls[0].url).toBe(`${base}/unsubscribes/%2B972%2050-123-4567`);
	});
});

describe('labels, members, templates and instance', () => {
	it('lists each as items', async () => {
		const reply = (call: { url: string }) =>
			call.url.endsWith('/labels')
				? { labels: [{ id: 'l1' }] }
				: call.url.endsWith('/members')
					? { members: [{ id: 'm1' }] }
					: call.url.endsWith('/templates')
						? { templates: [{ name: 't' }] }
						: { status: 'connected' };
		for (const [handler, expected] of [
			[labelHandlers.getMany, [{ id: 'l1' }]],
			[memberHandlers.getMany, [{ id: 'm1' }]],
			[templateHandlers.getMany, [{ name: 't' }]],
			[instanceHandlers.getStatus, [{ status: 'connected' }]],
		] as const) {
			const { ctx } = fakeExecute({}, reply);
			expect((await handler(ctx, 0)).map((i) => i.json)).toEqual(expected);
		}
	});
});
