import { NodeApiError } from 'n8n-workflow';
import { buildMultipart } from '../nodes/OverSend/transport/multipart';
import { getAll } from '../nodes/OverSend/transport/paginate';
import { apiDownload, apiRequest, baseUrlOf, describeApiError, fileNameFromDisposition, isNotFound } from '../nodes/OverSend/transport/request';
import { fakeExecute, httpError } from './helpers';

describe('baseUrlOf', () => {
	it('defaults to production and trims slashes and a trailing /v1', () => {
		expect(baseUrlOf({})).toBe('https://api.oversend.co.il');
		expect(baseUrlOf({ baseUrl: '  ' })).toBe('https://api.oversend.co.il');
		expect(baseUrlOf({ baseUrl: 'http://localhost:4010/' })).toBe('http://localhost:4010');
		expect(baseUrlOf({ baseUrl: 'https://api.example.test/v1/' })).toBe('https://api.example.test');
	});
});

describe('apiRequest', () => {
	it('calls /v1 with the credential, JSON, query and headers', async () => {
		const { ctx, calls } = fakeExecute({}, () => ({ ok: true }));
		const result = await apiRequest(ctx, 'POST', '/messages', { body: { a: 1 }, qs: { q: 'x' }, headers: { 'Idempotency-Key': 'k' } });
		expect(result).toEqual({ ok: true });
		expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://api.example.test/v1/messages', body: { a: 1 }, qs: { q: 'x' }, headers: { 'Idempotency-Key': 'k' }, json: true });
	});

	it('sends a Buffer body raw and parses a JSON text answer', async () => {
		const { ctx, calls } = fakeExecute({}, () => '{"id":"m1"}');
		const result = await apiRequest(ctx, 'POST', '/messages/media', { body: Buffer.from('x'), headers: { 'Content-Type': 'multipart/form-data; boundary=b' } });
		expect(result).toEqual({ id: 'm1' });
		expect(calls[0].json).toBe(false);
	});

	it.each(['body', 'data', 'cause'] as const)('turns an OverSend error (%s shape) into a NodeApiError with code and hint', async (shape) => {
		const { ctx } = fakeExecute({}, () => {
			throw httpError(409, { error: 'contact_unsubscribed' }, {}, shape);
		});
		const error = await apiRequest(ctx, 'POST', '/messages').catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('OverSend: contact_unsubscribed');
		expect((error as NodeApiError).description).toContain('Ignore Unsubscribe');
		expect((error as NodeApiError).httpCode).toBe('409');
	});
});

describe('describeApiError', () => {
	it('lists validation fields and the needed scope', () => {
		expect(describeApiError({ error: 'validation_failed', details: { fields: [{ path: 'to', message: 'required' }] } }, 400).description).toBe('Fields: to (required)');
		expect(describeApiError({ error: 'insufficient_scope', details: { required: 'webhooks:manage' } }, 403).description).toContain('Needed scope: webhooks:manage');
	});

	it('says when a rate limit resets', () => {
		const { message, description } = describeApiError({ error: 'rate_limited' }, 429, { 'x-ratelimit-reset': '1800000000' });
		expect(message).toBe('OverSend: rate_limited');
		expect(description).toContain('2027-01-15T08:00:00.000Z');
	});

	it('never prints an object for an unknown answer', () => {
		expect(describeApiError('<html>bad gateway</html>', 502)).toEqual({ message: 'OverSend answered HTTP 502', description: '' });
		expect(describeApiError(Buffer.from('{"error":"not_found"}'), 404).message).toBe('OverSend: not_found');
		expect(describeApiError(undefined, undefined).message).toBe('OverSend could not be reached');
	});
});

describe('isNotFound', () => {
	it('recognises a 404 from apiRequest', async () => {
		const { ctx } = fakeExecute({}, () => {
			throw httpError(404, { error: 'not_found' });
		});
		expect(isNotFound(await apiRequest(ctx, 'DELETE', '/webhooks/x').catch((e: unknown) => e))).toBe(true);
		expect(isNotFound(new Error('x'))).toBe(false);
	});
});

describe('getAll', () => {
	const pages: Record<string, unknown> = {
		'': { chats: [{ id: 1 }, { id: 2 }], nextCursor: 'c2' },
		c2: { chats: [{ id: 3 }], nextCursor: null },
	};

	it('follows nextCursor when returning all', async () => {
		const { ctx, calls } = fakeExecute({}, (call) => pages[(call.qs?.cursor as string) ?? '']);
		expect(await getAll(ctx, '/chats', 'chats', { type: 'group' }, true, 0)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect(calls.map((c) => c.qs)).toEqual([{ type: 'group', limit: 100 }, { type: 'group', limit: 100, cursor: 'c2' }]);
	});

	it('stops at the limit and asks for no more than it needs', async () => {
		const { ctx, calls } = fakeExecute({}, (call) => pages[(call.qs?.cursor as string) ?? '']);
		expect(await getAll(ctx, '/chats', 'chats', {}, false, 2)).toEqual([{ id: 1 }, { id: 2 }]);
		expect(calls).toHaveLength(1);
		expect(calls[0].qs).toEqual({ limit: 2 });
	});

	it('caps the page size at the endpoint maximum', async () => {
		const { ctx, calls } = fakeExecute({}, () => ({ unsubscribes: [], nextCursor: null }));
		await getAll(ctx, '/unsubscribes', 'unsubscribes', {}, false, 500, 200);
		expect(calls[0].qs).toEqual({ limit: 200 });
	});
});

describe('buildMultipart', () => {
	it('writes fields and the file with a UTF-8 name', () => {
		const { body, contentType } = buildMultipart({ chatId: 'c1', caption: 'שלום' }, { field: 'file', fileName: 'חשבונית.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF') }, 'B');
		expect(contentType).toBe('multipart/form-data; boundary=B');
		expect(body.toString('utf8')).toBe(
			'--B\r\nContent-Disposition: form-data; name="chatId"\r\n\r\nc1\r\n' +
				'--B\r\nContent-Disposition: form-data; name="caption"\r\n\r\nשלום\r\n' +
				'--B\r\nContent-Disposition: form-data; name="file"; filename="חשבונית.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF\r\n--B--\r\n',
		);
	});

	it('keeps quotes and line breaks out of the headers', () => {
		const { body } = buildMultipart({}, { field: 'file', fileName: 'a"b\r\n.txt', mimeType: 'text/plain', data: Buffer.from('') }, 'B');
		expect(body.toString('utf8')).toContain('filename="a%22b  .txt"');
	});
});

describe('downloads', () => {
	it('reads the file name from Content-Disposition', () => {
		expect(fileNameFromDisposition("attachment; filename*=UTF-8''%D7%A7%D7%91%D7%9C%D7%94.pdf")).toBe('קבלה.pdf');
		expect(fileNameFromDisposition('inline; filename="photo.jpg"')).toBe('photo.jpg');
		expect(fileNameFromDisposition(undefined)).toBeUndefined();
	});

	it('returns bytes, type and name', async () => {
		const { ctx, calls } = fakeExecute({}, () => ({
			body: Buffer.from('JPEG'),
			headers: { 'content-type': 'image/jpeg', 'content-disposition': 'inline; filename="a.jpg"' },
		}));
		const file = await apiDownload(ctx, '/messages/m1/media');
		expect(file).toEqual({ data: Buffer.from('JPEG'), mimeType: 'image/jpeg', fileName: 'a.jpg' });
		expect(calls[0]).toMatchObject({ encoding: 'arraybuffer', returnFullResponse: true, json: false });
	});
});
