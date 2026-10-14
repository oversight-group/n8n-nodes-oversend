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
	const testUrl = 'https://n8n.example.test/webhook-test/abc';
	const base = 'https://api.example.test/v1/webhooks';

	it('creates the webhook and keeps its id and secret under its URL', async () => {
		const { ctx, calls, staticData } = fakeHook({ events: ['message.received'] }, () => ({ webhook: { id: 'w1', url, events: ['message.received'] }, secret }));
		expect(await methods.create.call(ctx)).toBe(true);
		expect(calls[0]).toMatchObject({ method: 'POST', url: base, body: { url, events: ['message.received'] } });
		expect(staticData).toEqual({ webhooks: { [url]: { id: 'w1', secret } } });
	});

	it('refuses an answer without an id or secret', async () => {
		for (const answer of [{ webhook: { id: 'w1' } }, { webhook: { id: 'w1' }, secret: '' }, { secret }, {}]) {
			const { ctx, staticData } = fakeHook({ events: ['message.received'] }, () => answer);
			await expect(methods.create.call(ctx)).rejects.toThrow();
			expect(staticData).toEqual({});
		}
	});

	it('finds its webhook when id, URL and events still match', async () => {
		const { ctx } = fakeHook({ events: ['message.received'] }, () => ({ webhooks: [{ id: 'w1', url, events: ['message.received'] }] }), { webhooks: { [url]: { id: 'w1', secret } } });
		expect(await methods.checkExists.call(ctx)).toBe(true);
	});

	it('cleans up and asks for a new one when the webhook is gone, changed, or the secret is lost', async () => {
		const cases = [
			{ webhooks: [], data: { webhooks: { [url]: { id: 'w1', secret } } } },
			{ webhooks: [{ id: 'w1', url, events: ['message.status'] }], data: { webhooks: { [url]: { id: 'w1', secret } } } },
			{ webhooks: [{ id: 'w9', url, events: ['message.received'] }], data: {} },
			{ webhooks: [{ id: 'w1', url, events: ['message.received'] }], data: { webhooks: { [url]: { id: 'w1' } } } },
		];
		for (const { webhooks, data } of cases) {
			const { ctx, calls, staticData } = fakeHook({ events: ['message.received'] }, (call) => (call.method === 'GET' ? { webhooks } : ''), { ...data });
			expect(await methods.checkExists.call(ctx)).toBe(false);
			expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(webhooks.map((w) => `${base}/${w.id}`));
			expect(staticData).toEqual({});
		}
	});

	it('replaces a webhook OverSend switched off after too many failures', async () => {
		const off = { id: 'w1', url, events: ['message.received'], enabled: false, disabledReason: 'too_many_failures' };
		const { ctx, calls, staticData } = fakeHook({ events: ['message.received'] }, (call) => (call.method === 'GET' ? { webhooks: [off] } : ''), { webhooks: { [url]: { id: 'w1', secret } } });
		expect(await methods.checkExists.call(ctx)).toBe(false);
		expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual([`${base}/w1`]);
		expect(staticData).toEqual({});
	});

	it('keeps a webhook a person switched off in Settings, and one that is enabled', async () => {
		for (const extra of [{ enabled: false, disabledReason: null }, { enabled: true, disabledReason: null }, {}]) {
			const { ctx, calls } = fakeHook({ events: ['message.received'] }, () => ({ webhooks: [{ id: 'w1', url, events: ['message.received'], ...extra }] }), { webhooks: { [url]: { id: 'w1', secret } } });
			expect(await methods.checkExists.call(ctx)).toBe(true);
			expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
		}
	});

	it('leaves the production webhook alone while the test URL is registered, checked and removed', async () => {
		const prod = { id: 'wp', url, events: ['message.received'] };
		const stored = () => ({ webhooks: { [url]: { id: 'wp', secret: 'whsec_prod' } } });
		const events = { events: ['message.received'] };

		// Test URL not yet known: check asks for a new one without touching production.
		const check = fakeHook(events, (call) => (call.method === 'GET' ? { webhooks: [prod] } : ''), stored(), testUrl);
		expect(await methods.checkExists.call(check.ctx)).toBe(false);
		expect(check.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
		expect(check.staticData).toEqual(stored());

		// Creating the test webhook adds an entry and keeps production's.
		const create = fakeHook(events, () => ({ webhook: { id: 'wt', url: testUrl, events: ['message.received'] }, secret: 'whsec_test' }), stored(), testUrl);
		expect(await methods.create.call(create.ctx)).toBe(true);
		expect(create.staticData).toEqual({ webhooks: { ...stored().webhooks, [testUrl]: { id: 'wt', secret: 'whsec_test' } } });

		// With both registered, each URL finds its own.
		const both = () => ({ webhooks: { ...stored().webhooks, [testUrl]: { id: 'wt', secret: 'whsec_test' } } });
		const list = { webhooks: [prod, { id: 'wt', url: testUrl, events: ['message.received'] }] };
		expect(await methods.checkExists.call(fakeHook(events, () => list, both(), testUrl).ctx)).toBe(true);
		expect(await methods.checkExists.call(fakeHook(events, () => list, both(), url).ctx)).toBe(true);

		// A stale test entry is cleaned without removing production.
		const stale = fakeHook(events, (call) => (call.method === 'GET' ? { webhooks: [prod] } : ''), both(), testUrl);
		expect(await methods.checkExists.call(stale.ctx)).toBe(false);
		expect(stale.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
		expect(stale.staticData).toEqual(stored());

		// Deleting the test webhook removes only its own.
		const del = fakeHook({}, () => '', both(), testUrl);
		expect(await methods.delete.call(del.ctx)).toBe(true);
		expect(del.calls.map((c) => [c.method, c.url])).toEqual([['DELETE', `${base}/wt`]]);
		expect(del.staticData).toEqual(stored());
	});

	it('deletes its webhook, treating "already gone" as done', async () => {
		const entry = () => ({ webhooks: { [url]: { id: 'w1', secret } } });
		const ok = fakeHook({}, () => '', entry());
		expect(await methods.delete.call(ok.ctx)).toBe(true);
		expect(ok.calls[0]).toMatchObject({ method: 'DELETE', url: `${base}/w1` });
		expect(ok.staticData).toEqual({});

		const gone = fakeHook({}, () => {
			throw httpError(404, { error: 'not_found' });
		}, entry());
		expect(await methods.delete.call(gone.ctx)).toBe(true);
		expect(gone.staticData).toEqual({});

		const down = fakeHook({}, () => {
			throw httpError(503, { error: 'internal_error' });
		}, entry());
		expect(await methods.delete.call(down.ctx)).toBe(false);
		expect(down.staticData).toEqual(entry());

		const none = fakeHook({}, () => '', {});
		expect(await methods.delete.call(none.ctx)).toBe(true);
		expect(none.calls).toEqual([]);
	});

	it('drops old single-webhook static data without calling the API for it', async () => {
		const old = () => ({ webhookId: 'w1', secret });
		const del = fakeHook({}, () => '', old());
		expect(await methods.delete.call(del.ctx)).toBe(true);
		expect(del.calls).toEqual([]);
		expect(del.staticData).toEqual({});

		const check = fakeHook({ events: ['message.received'] }, () => ({ webhooks: [] }), old());
		expect(await methods.checkExists.call(check.ctx)).toBe(false);
		expect(check.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
		expect(check.staticData).toEqual({});
	});
});

describe('receiving', () => {
	const trigger = new OverSendTrigger();
	const event = { id: 'evt_1', type: 'message.received', createdAt: '2026-10-14T09:00:00.000Z', companyId: 'c1', data: { id: 'm1', isGroup: true, direction: 'inbound', text: 'שלום' } };
	const raw = JSON.stringify(event);
	const params = { events: ['message.received'], options: {} };
	const stored = () => ({ webhooks: { 'https://n8n.example.test/webhook/abc': { id: 'w1', secret } } });
	const at = () => Math.floor(Date.now() / 1000);

	it('starts the workflow with the full event', async () => {
		const { ctx } = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, at()) }, stored());
		expect(await trigger.webhook.call(ctx)).toEqual({ workflowData: [[{ json: event }]] });
	});

	it('outputs only data when asked', async () => {
		const { ctx } = fakeWebhook({ ...params, options: { output: 'data' } }, raw, { 'x-oversend-signature': sign(raw, at()) }, stored());
		expect(await trigger.webhook.call(ctx)).toEqual({ workflowData: [[{ json: event.data }]] });
	});

	it('answers 401 and starts nothing on a bad signature or with nothing registered', async () => {
		const bad = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, at(), 'wrong') }, stored());
		expect(await trigger.webhook.call(bad.ctx)).toEqual({ noWebhookResponse: true });
		expect(bad.response.statusCode).toBe(401);
		const empty = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, at()) }, {});
		expect(await trigger.webhook.call(empty.ctx)).toEqual({ noWebhookResponse: true });
		expect(empty.response.statusCode).toBe(401);
		const old = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, at()) }, { webhookId: 'w1', secret });
		expect(await trigger.webhook.call(old.ctx)).toEqual({ noWebhookResponse: true });
		expect(old.response.statusCode).toBe(401);
	});

	it('accepts a delivery signed with either stored secret, and rejects one signed with neither', async () => {
		const two = () => ({ webhooks: { prod: { id: 'wp', secret: 'whsec_prod' }, test: { id: 'wt', secret: 'whsec_test' } } });
		for (const key of ['whsec_prod', 'whsec_test']) {
			const { ctx } = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, at(), key) }, two());
			expect(await trigger.webhook.call(ctx)).toEqual({ workflowData: [[{ json: event }]] });
		}
		const none = fakeWebhook(params, raw, { 'x-oversend-signature': sign(raw, at(), 'whsec_other') }, two());
		expect(await trigger.webhook.call(none.ctx)).toEqual({ noWebhookResponse: true });
		expect(none.response.statusCode).toBe(401);
	});

	it('acknowledges test pings, filtered events and signed junk without starting', async () => {
		const ping = JSON.stringify({ ...event, type: 'test.ping' });
		const a = fakeWebhook(params, ping, { 'x-oversend-signature': sign(ping, at()) }, stored());
		expect(await trigger.webhook.call(a.ctx)).toEqual({});
		const b = fakeWebhook({ ...params, options: { chatType: 'direct' } }, raw, { 'x-oversend-signature': sign(raw, at()) }, stored());
		expect(await trigger.webhook.call(b.ctx)).toEqual({});
		const junk = 'not json';
		const c = fakeWebhook(params, junk, { 'x-oversend-signature': sign(junk, at()) }, stored());
		expect(await trigger.webhook.call(c.ctx)).toEqual({});
	});
});
