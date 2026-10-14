import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const CREDENTIAL = 'overSendApi';
export const DEFAULT_BASE_URL = 'https://api.oversend.co.il';

export type ApiContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

export interface ApiRequestOptions {
	qs?: IDataObject;
	body?: IDataObject | Buffer;
	headers?: IDataObject;
}

/** Plain-language hints for the errors people run into; the code itself is always shown too. */
const HINTS: Record<string, string> = {
	contact_unsubscribed:
		'The contact unsubscribed. Turn on "Ignore Unsubscribe" in Options only for messages they asked for.',
	insufficient_scope: 'The API key lacks a permission. Create a key with the scope named below.',
	invalid_api_key: 'The API key is wrong, revoked or expired.',
	limit_reached: 'An OverSend limit was reached.',
	not_connected: 'The WhatsApp number is not connected in OverSend.',
	not_on_whatsapp: 'This number has no WhatsApp account.',
	not_supported: 'This needs a WhatsApp Web number; the company is connected through the Cloud API.',
	rate_limited: 'Too many requests.',
	template_not_found: 'No approved template with this name and language.',
	webhooks_unavailable: 'Webhooks are not available on this OverSend server.',
	window_closed: 'More than 24 hours passed since the customer last wrote: send an approved template instead.',
};

export function baseUrlOf(credentials: IDataObject): string {
	const configured =
		typeof credentials.baseUrl === 'string' && credentials.baseUrl.trim() !== ''
			? credentials.baseUrl.trim()
			: DEFAULT_BASE_URL;
	return configured.replace(/\/+$/, '').replace(/\/v1$/, '');
}

/** A Buffer after JSON serialization: `{ type: 'Buffer', data: number[] }`. */
function isSerializedBuffer(body: unknown): body is { type: 'Buffer'; data: number[] } {
	const b = body as { type?: unknown; data?: unknown } | null;
	return typeof b === 'object' && b !== null && b.type === 'Buffer' && Array.isArray(b.data);
}

function parseBody(body: unknown): unknown {
	if (Buffer.isBuffer(body)) return parseBody(body.toString('utf8'));
	if (body instanceof ArrayBuffer) return parseBody(Buffer.from(body));
	if (ArrayBuffer.isView(body)) return parseBody(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
	if (isSerializedBuffer(body)) return parseBody(Buffer.from(body.data));
	if (typeof body === 'string') {
		try {
			return JSON.parse(body);
		} catch {
			return undefined;
		}
	}
	return body;
}

interface ErrorBody {
	error?: unknown;
	details?: { fields?: Array<{ path?: unknown; message?: unknown }>; required?: unknown; kind?: unknown; limit?: unknown };
}

/** OverSend answers errors as `{ error: code, details? }`. */
export function describeApiError(
	body: unknown,
	status?: number,
	headers: Record<string, unknown> = {},
): { message: string; description: string } {
	const parsed = parseBody(body) as ErrorBody | undefined;
	const code = typeof parsed?.error === 'string' ? parsed.error : undefined;
	if (code === undefined) {
		return {
			message: status ? `OverSend answered HTTP ${status}` : 'OverSend could not be reached',
			description: '',
		};
	}
	const parts: string[] = [];
	if (code === 'limit_reached' && typeof parsed?.details?.kind === 'string' && parsed.details.limit !== undefined) {
		parts.push(`An OverSend limit was reached (${parsed.details.kind}: ${String(parsed.details.limit)}).`);
	} else if (HINTS[code]) parts.push(HINTS[code]);
	const fields = (Array.isArray(parsed?.details?.fields) ? parsed!.details!.fields! : []).filter(
		(f) => typeof f === 'object' && f !== null,
	);
	if (fields.length > 0) {
		parts.push(`Fields: ${fields.map((f) => `${String(f.path)} (${String(f.message)})`).join(', ')}`);
	}
	if (typeof parsed?.details?.required === 'string') parts.push(`Needed scope: ${parsed.details.required}`);
	const reset = Number(headers['x-ratelimit-reset']);
	if (code === 'rate_limited' && Number.isFinite(reset) && reset > 0) {
		const resetAt = new Date(reset * 1000);
		if (!Number.isNaN(resetAt.getTime())) parts.push(`The limit resets at ${resetAt.toISOString()}.`);
	}
	return { message: `OverSend: ${code}`, description: parts.join(' ') };
}

interface ResponseLike {
	body?: unknown;
	data?: unknown;
	status?: number;
	statusCode?: number;
	headers?: Record<string, unknown>;
}

/** The HTTP answer inside an error from n8n's request helper, in the shapes n8n versions use. */
function errorResponse(error: unknown): { body: unknown; status?: number; headers: Record<string, unknown> } {
	const e = error as {
		response?: ResponseLike;
		cause?: { response?: ResponseLike };
		context?: { data?: unknown };
		httpCode?: string;
	};
	const response = e.response ?? e.cause?.response;
	const status = response?.status ?? response?.statusCode ?? (e.httpCode ? Number(e.httpCode) : undefined);
	// A NodeApiError built from an HTTP error keeps the answer body in context.data.
	return { body: response?.body ?? response?.data ?? e.context?.data, status, headers: response?.headers ?? {} };
}

async function send(ctx: ApiContext, options: IHttpRequestOptions): Promise<unknown> {
	try {
		return await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, options);
	} catch (error) {
		// Already built by this transport (a nested call): keep it as it is.
		const ours = error instanceof NodeApiError && error.message.startsWith('OverSend') ? error : undefined;
		if (ours) throw ours;
		const { body, status, headers } = errorResponse(error);
		const { message, description } = describeApiError(body, status, headers);
		const parsed = parseBody(body);
		throw new NodeApiError(
			ctx.getNode(),
			(typeof parsed === 'object' && parsed !== null ? parsed : { message: (error as Error).message }) as JsonObject,
			{ message, description, httpCode: status ? String(status) : undefined },
		);
	}
}

export async function apiRequest<T = IDataObject>(
	ctx: ApiContext,
	method: IHttpRequestMethods,
	path: string,
	options: ApiRequestOptions = {},
): Promise<T> {
	const credentials = await ctx.getCredentials(CREDENTIAL);
	const raw = Buffer.isBuffer(options.body);
	const response = await send(ctx, {
		method,
		url: `${baseUrlOf(credentials)}/v1${path}`,
		qs: options.qs,
		body: options.body,
		headers: options.headers,
		json: !raw,
	});
	return (typeof response === 'string' || Buffer.isBuffer(response) ? parseBody(response) ?? {} : response) as T;
}

export function fileNameFromDisposition(header: string | undefined): string | undefined {
	if (!header) return undefined;
	const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (encoded) {
		try {
			return decodeURIComponent(encoded[1]);
		} catch {
			return encoded[1];
		}
	}
	return /filename="?([^";]+)"?/i.exec(header)?.[1];
}

export async function apiDownload(
	ctx: ApiContext,
	path: string,
): Promise<{ data: Buffer; mimeType: string; fileName: string | undefined }> {
	const credentials = await ctx.getCredentials(CREDENTIAL);
	const response = (await send(ctx, {
		method: 'GET',
		url: `${baseUrlOf(credentials)}/v1${path}`,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		json: false,
	})) as { body: ArrayBuffer | Buffer; headers: Record<string, string | undefined> };
	const data = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
	return {
		data,
		mimeType: response.headers['content-type'] ?? 'application/octet-stream',
		fileName: fileNameFromDisposition(response.headers['content-disposition']),
	};
}

export function isNotFound(error: unknown): boolean {
	return error instanceof NodeApiError && error.httpCode === '404';
}
