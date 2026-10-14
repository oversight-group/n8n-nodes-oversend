import { createHmac } from 'crypto';
import { passes } from '../nodes/OverSendTrigger/filters';
import { OverSendTrigger } from '../nodes/OverSendTrigger/OverSendTrigger.node';
import { verifySignature } from '../nodes/OverSendTrigger/signature';
import { fakeHook, fakeWebhook, httpError } from './helpers';

const secret = 'whsec_test';
const sign = (body: string, t: number, key = secret) => `t=${t},v1=${createHmac('sha256', key).update(`${t}.${body}`).digest('hex')}`;
const now = Math.floor(Date.now() / 1000);

describe('verifySignature', () => {
	const body = '{"id":"evt_1","type":"message.received"}';
	it('accepts a fresh, correct signature', () => expect(verifySignature(secret, sign(body, now), body, now)).toBe(true));
	it('refuses a tampered body, a wrong secret, an old or future time, and junk', () => {
		expect(verifySignature(secret, sign(body, now), `${body} `, now)).toBe(false);
		expect(verifySignature(secret, sign(body, now, 'other'), body, now)).toBe(false);
		expect(verifySignature(secret, sign(body, now - 301), body, now)).toBe(false);
		expect(verifySignature(secret, sign(body, now + 301), body, now)).toBe(false);
		for (const header of [undefined, '', 't=1', 'v1=abc', 't=x,v1=00', `t=${now},v1=zz`]) expect(verifySignature(secret, header, body, now)).toBe(false);
	});
});

describe('passes', () => {
	const message = (type: string, data: Record<string, unknown>) => ({ id: 'e', type, createdAt: '', companyId: 'c', data });
	const inboundGroup = message('message.received', { isGroup: true, direction: 'inbound' });
	it('keeps only the chosen events', () => {
		expect(passes(inboundGroup, ['message.received'], {})).toBe(true);
		expect(passes(inboundGroup, ['message.status'], {})).toBe(false);
	});
	it('filters messages by chat type and direction, including reactions and chat updates', () => {
		expect(passes(inboundGroup, ['message.received'], { chatType: 'direct' })).toBe(false);
		expect(passes(inboundGroup, ['message.received'], { chatType: 'group', direction: 'inbound' })).toBe(true);
		expect(passes(inboundGroup, ['message.received'], { direction: 'outbound' })).toBe(false);
		const reaction = message('message.reaction', { message: { isGroup: false, direction: 'outbound' }, reaction: {} });
		expect(passes(reaction, ['message.reaction'], { chatType: 'direct', direction: 'outbound' })).toBe(true);
		const chat = message('chat.updated', { chat: { type: 'group' }, changes: ['status'] });
		expect(passes(chat, ['chat.updated'], { chatType: 'group', direction: 'inbound' })).toBe(true);
		expect(passes(chat, ['chat.updated'], { chatType: 'direct' })).toBe(false);
	});
	it('lets events without a chat through the chat filters', () => {
		expect(passes(message('instance.status', { status: 'connected' }), ['instance.status'], { chatType: 'group' })).toBe(true);
	});
});

describe('webhook registration', () => {
	const trigger = new OverSendTrigger();
	const methods = trigger.webhookMethods.default;
	const url = 'https://n8n.example.test/webhook/abc';

	it('creates the webhook and keeps its id and secret', async () => {
		const { ctx, calls, staticData } = fakeHook({ events: ['message.received'] }, () => ({ webhook: { id: 'w1', url, events: ['message.received'] }, secret }));
		expect(await methods.create.call(ctx)).toBe(true);
		expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://api.example.test/v1/webhooks', body: { url, events: ['message.received'] } });
		expect(staticData).toEqual({ webhookId: 'w1', secret });
	});

	it('finds its webhook when id, URL and events still match', async () => {
		const { ctx } = fakeHook({ events: ['message.received'] }, () => ({ webhooks: [{ id: 'w1', url, events: ['message.received'] }] }), { webhookId: 'w1', secret });
		expect(await methods.checkExists.call(ctx)).toBe(true);
	});

	it('cleans up and asks for a new one when the webhook is gone, changed, or the secret is lost', async () => {
		const cases = [
			{ webhooks: [], data: { webhookId: 'w1', secret } },
			{ webhooks: [{ id: 'w1', url, events: ['message.status'] }], data: { webhookId: 'w1', secret } },
			{ webhooks: [{ id: 'w9', url, events: ['message.received'] }], data: {} },
		];
		for (const { webhooks, data } of cases) {
			const { ctx, calls, staticData } = fakeHook({ events: ['message.received'] }, (call) => (call.method === 'GET' ? { webhooks } : ''), { ...data });
			expect(await methods.checkExists.call(ctx)).toBe(false);
			expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(webhooks.map((w) => `https://api.example.test/v1/webhooks/${w.id}`));
			expect(staticData).toEqual({});
		}
	});

	it('deletes its webhook, treating "already gone" as done', async () => {
		const ok = fakeHook({}, () => '', { webhookId: 'w1', secret });
		expect(await methods.delete.call(ok.ctx)).toBe(true);
		expect(ok.calls[0]).toMatchObject({ method: 'DELETE', url: 'https://api.example.test/v1/webhooks/w1' });
		expect(ok.staticData).toEqual({});

		const gone = fakeHook({}, () => {
			throw httpError(404, { error: 'not_found' });
		}, { webhookId: 'w1', secret });
		expect(await methods.delete.call(gone.ctx)).toBe(true);

		const down = fakeHook({}, () => {
			throw httpError(503, { error: 'internal_error' });
		}, { webhookId: 'w1', secret });
		expect(await methods.delete.call(down.ctx)).toBe(false);
	});
});

describe('receiving', () => {
	const trigger = new OverSendTrigger();
	const event = { id: 'evt_1', type: 'message.received', createdAt: '2026-10-14T09:00:00.000Z', companyId: 'c1', data: { id: 'm1', isGroup: true, direction: 'inbound', text: 'שלום' } };
	const raw = JSON.stringify(event);
	const params = { events: ['message.received'], options: {} };

	it('starts the workflow with the full event', async () => {
		const { ctx } = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, Math.floor(Date.now() / 1000)) }, { secret });
		expect(await trigger.webhook.call(ctx)).toEqual({ workflowData: [[{ json: event }]] });
	});

	it('outputs only data when asked', async () => {
		const { ctx } = fakeWebhook({ ...params, options: { output: 'data' } }, raw, { 'x-oversend-signature': sign(raw, Math.floor(Date.now() / 1000)) }, { secret });
		expect(await trigger.webhook.call(ctx)).toEqual({ workflowData: [[{ json: event.data }]] });
	});

	it('answers 401 and starts nothing on a bad signature', async () => {
		const { ctx, response } = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, Math.floor(Date.now() / 1000), 'wrong') }, { secret });
		expect(await trigger.webhook.call(ctx)).toEqual({ noWebhookResponse: true });
		expect(response.statusCode).toBe(401);
	});

	it('acknowledges test pings and filtered events without starting', async () => {
		const ping = JSON.stringify({ ...event, type: 'test.ping' });
		const a = fakeWebhook(params, ping, { 'x-oversend-signature': sign(ping, Math.floor(Date.now() / 1000)) }, { secret });
		expect(await trigger.webhook.call(a.ctx)).toEqual({});
		const b = fakeWebhook({ ...params, options: { chatType: 'direct' } }, raw, { 'x-oversend-signature': sign(raw, Math.floor(Date.now() / 1000)) }, { secret });
		expect(await trigger.webhook.call(b.ctx)).toEqual({});
	});
});
