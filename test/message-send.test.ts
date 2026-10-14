import { messageHandlers } from '../nodes/OverSend/operations/message';
import { defaultIdempotencyKey, toIso } from '../nodes/OverSend/helpers';
import { fakeExecute, rl } from './helpers';

const sent = { id: 'm1', status: 'pending' };
const run = async (operation: string, params: Record<string, unknown>, extra = {}) => {
	const { ctx, calls } = fakeExecute(params, () => sent, extra);
	const items = await messageHandlers[operation](ctx, 0);
	return { items, call: calls[0] };
};
const toPhone = { sendTo: 'phone', phone: ' +972 50-123-4567 ' };

describe('recipient', () => {
	it('sends to a phone, a chat or a group', async () => {
		expect((await run('sendText', { ...toPhone, text: 'hi' })).call.body).toMatchObject({ to: '+972 50-123-4567' });
		expect((await run('sendText', { sendTo: 'chat', chatId: rl('c1'), text: 'hi' })).call.body).toMatchObject({ chatId: 'c1' });
		expect((await run('sendText', { sendTo: 'group', groupId: rl('g1'), text: 'hi' })).call.body).toMatchObject({ chatId: 'g1' });
	});

	it('refuses an empty chat choice before calling the API', async () => {
		await expect(run('sendText', { sendTo: 'group', groupId: rl(''), text: 'hi' })).rejects.toThrow('Choose a group');
	});
});

describe('sends', () => {
	it('text with reply and mentions', async () => {
		const { items, call } = await run('sendText', { ...toPhone, text: 'hi @972501234567', textOptions: { replyTo: ' m0 ', mentions: '972501234567, 972527654321' } });
		expect(call).toMatchObject({ method: 'POST', url: 'https://api.example.test/v1/messages' });
		expect(call.body).toEqual({ to: '+972 50-123-4567', type: 'text', text: 'hi @972501234567', replyTo: 'm0', mentions: ['972501234567', '972527654321'] });
		expect(items).toEqual([{ json: sent, pairedItem: { item: 0 } }]);
	});

	it('media by URL', async () => {
		const { call } = await run('sendMedia', { ...toPhone, mediaType: 'document', mediaUrl: ' https://x.test/a.pdf ', mediaOptions: { caption: 'Invoice', fileName: 'invoice.pdf' } });
		expect(call.body).toMatchObject({ type: 'document', media: { url: 'https://x.test/a.pdf', caption: 'Invoice', filename: 'invoice.pdf' } });
	});

	it('media from binary, as multipart', async () => {
		const binary = { data: { meta: { fileName: 'photo.jpg', mimeType: 'image/jpeg' }, data: Buffer.from('JPEG') } };
		const { ctx, calls } = fakeExecute({ sendTo: 'group', groupId: rl('g1'), binaryPropertyName: 'data', caption: 'Look', options: { ignoreUnsubscribe: true } }, () => '{"id":"m2"}', { binary });
		const items = await messageHandlers.sendBinary(ctx, 0);
		expect(items[0].json).toEqual({ id: 'm2' });
		const call = calls[0];
		expect(call.url).toBe('https://api.example.test/v1/messages/media');
		expect(String(call.headers?.['Content-Type'])).toMatch(/^multipart\/form-data; boundary=/);
		const text = (call.body as Buffer).toString('utf8');
		expect(text).toContain('name="chatId"\r\n\r\ng1');
		expect(text).toContain('name="caption"\r\n\r\nLook');
		expect(text).toContain('name="ignoreUnsubscribe"\r\n\r\ntrue');
		expect(text).toContain('filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\nJPEG');
	});

	it('template with mapped fields', async () => {
		const { call } = await run('sendTemplate', { ...toPhone, template: 'meta|he|order_ready', templateFields: { mappingMode: 'defineBelow', value: { body_1: 'Dana' } } });
		expect(call.body).toMatchObject({ type: 'template', template: { name: 'order_ready', language: 'he', params: { body: ['Dana'] } } });
	});

	it('location, contact cards and poll', async () => {
		expect((await run('sendLocation', { ...toPhone, latitude: 32.08, longitude: 34.78, locationOptions: { name: 'Office' } })).call.body).toMatchObject({
			type: 'location',
			location: { latitude: 32.08, longitude: 34.78, name: 'Office' },
		});
		expect((await run('sendContacts', { ...toPhone, contacts: { contact: [{ name: 'Support', phone: '+97235550100' }] } })).call.body).toMatchObject({
			type: 'contact',
			contacts: [{ name: 'Support', phone: '+97235550100' }],
		});
		expect((await run('sendPoll', { ...toPhone, question: 'Lunch?', pollOptions: ['Pizza', ' ', 'Sushi'], multipleAnswers: true })).call.body).toMatchObject({
			type: 'poll',
			poll: { question: 'Lunch?', options: ['Pizza', 'Sushi'], multiple: true },
		});
	});
});

describe('send options', () => {
	it('schedules, ignores unsubscribe and passes an explicit key', async () => {
		const { call } = await run('sendText', { ...toPhone, text: 'hi', options: { sendAt: '2026-10-15T07:00:00+03:00', ignoreUnsubscribe: true, idempotencyKey: ' order-1 ' } });
		expect(call.body).toMatchObject({ sendAt: '2026-10-15T04:00:00.000Z', ignoreUnsubscribe: true });
		expect(call.headers).toEqual({ 'Idempotency-Key': 'order-1' });
	});

	it('defaults to a stable key per execution, node and item, under 64 characters', async () => {
		const first = (await run('sendText', { ...toPhone, text: 'hi' }, { executionId: 'e9' })).call.headers?.['Idempotency-Key'] as string;
		const again = (await run('sendText', { ...toPhone, text: 'hi' }, { executionId: 'e9' })).call.headers?.['Idempotency-Key'] as string;
		const other = (await run('sendText', { ...toPhone, text: 'hi' }, { executionId: 'e10' })).call.headers?.['Idempotency-Key'] as string;
		expect(first).toBe(again);
		expect(first).not.toBe(other);
		expect(first).toMatch(/^n8n-[0-9a-f]{40}$/);
	});

	it('sends no key when n8n has no execution id', () => {
		const { ctx } = fakeExecute({}, () => sent, { executionId: '' });
		expect(defaultIdempotencyKey(ctx, 0)).toBeUndefined();
	});
});

describe('toIso', () => {
	it('keeps an explicit offset', () => {
		expect(toIso('2026-10-15T07:00:00Z', 'Asia/Jerusalem')).toBe('2026-10-15T07:00:00.000Z');
	});

	it("reads a time without an offset in the workflow's time zone", () => {
		expect(toIso('2026-10-15T10:00:00', 'Asia/Jerusalem')).toBe('2026-10-15T07:00:00.000Z');
		expect(toIso('2026-12-15T10:00:00', 'Asia/Jerusalem')).toBe('2026-12-15T08:00:00.000Z');
		expect(toIso('2026-10-15T10:00:00', 'UTC')).toBe('2026-10-15T10:00:00.000Z');
	});

	it('refuses what is not a time', () => {
		expect(() => toIso('tomorrow', 'UTC')).toThrow('Send At');
	});
});
