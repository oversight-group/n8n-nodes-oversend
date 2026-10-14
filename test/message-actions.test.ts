import { messageHandlers } from '../nodes/OverSend/operations/message';
import { fakeExecute, rl } from './helpers';

describe('message reads and actions', () => {
	it('gets one message, escaping the id', async () => {
		const { ctx, calls } = fakeExecute({ messageId: 'a/b' }, () => ({ id: 'a/b' }));
		expect(await messageHandlers.get(ctx, 0)).toEqual([{ json: { id: 'a/b' }, pairedItem: { item: 0 } }]);
		expect(calls[0]).toMatchObject({ method: 'GET', url: 'https://api.example.test/v1/messages/a%2Fb' });
	});

	it("gets many with a chat and filters, one item per message", async () => {
		const { ctx, calls } = fakeExecute(
			{ filterChatId: rl('c1'), returnAll: false, limit: 2, filters: { direction: 'inbound', receivedSince: '2026-10-14T09:00:00Z' } },
			() => ({ messages: [{ id: 'm1' }, { id: 'm2' }], nextCursor: 'x' }),
		);
		const items = await messageHandlers.getMany(ctx, 0);
		expect(items.map((it) => it.json.id)).toEqual(['m1', 'm2']);
		expect(calls[0].qs).toEqual({ chatId: 'c1', direction: 'inbound', receivedSince: '2026-10-14T09:00:00.000Z', limit: 2 });
	});

	it('gets many without a chat', async () => {
		const { ctx, calls } = fakeExecute({ filterChatId: rl(''), returnAll: true, filters: {} }, () => ({ messages: [], nextCursor: null }));
		expect(await messageHandlers.getMany(ctx, 0)).toEqual([]);
		expect(calls[0].qs).toEqual({ limit: 100 });
	});

	it('downloads a file into a binary field', async () => {
		const { ctx } = fakeExecute({ messageId: 'm1', binaryPropertyName: 'file' }, () => ({
			body: Buffer.from('PDF'),
			headers: { 'content-type': 'application/pdf', 'content-disposition': "attachment; filename*=UTF-8''a.pdf" },
		}));
		const [item] = await messageHandlers.downloadMedia(ctx, 0);
		expect(item.json).toEqual({ messageId: 'm1', fileName: 'a.pdf', mimeType: 'application/pdf', size: 3 });
		expect(item.binary?.file).toEqual({ data: Buffer.from('PDF').toString('base64'), fileName: 'a.pdf', mimeType: 'application/pdf' });
	});

	it('reacts, edits, deletes and votes', async () => {
		const reply = (call: { method: string }) => (call.method === 'DELETE' ? '' : { id: 'm1' });
		const react = fakeExecute({ messageId: 'm1', emoji: '' }, reply);
		await messageHandlers.react(react.ctx, 0);
		expect(react.calls[0]).toMatchObject({ method: 'PUT', url: 'https://api.example.test/v1/messages/m1/reaction', body: { emoji: '' } });

		const edit = fakeExecute({ messageId: 'm1', newText: 'fixed' }, reply);
		await messageHandlers.edit(edit.ctx, 0);
		expect(edit.calls[0]).toMatchObject({ method: 'PATCH', body: { text: 'fixed' } });

		const del = fakeExecute({ messageId: 'm1' }, reply);
		expect((await messageHandlers.delete(del.ctx, 0))[0].json).toEqual({ id: 'm1', deleted: true });

		const vote = fakeExecute({ messageId: 'm1', voteOptions: ['Pizza', ' '] }, reply);
		await messageHandlers.vote(vote.ctx, 0);
		expect(vote.calls[0]).toMatchObject({ method: 'PUT', url: 'https://api.example.test/v1/messages/m1/vote', body: { options: ['Pizza'] } });
	});

	it('returns the message JSON the API answers to a delete unchanged', async () => {
		const { ctx, calls } = fakeExecute({ messageId: 'm1' }, () => ({ id: 'm1', deleted: true, type: 'text' }));
		expect((await messageHandlers.delete(ctx, 0))[0].json).toEqual({ id: 'm1', deleted: true, type: 'text' });
		expect(calls[0]).toMatchObject({ method: 'DELETE', url: 'https://api.example.test/v1/messages/m1' });
	});
});
