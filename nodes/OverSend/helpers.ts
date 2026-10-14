import { createHash } from 'crypto';
import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export type Handler = (ctx: IExecuteFunctions, i: number) => Promise<INodeExecutionData[]>;

/** Drops undefined (and only undefined). */
export function compact(input: Record<string, unknown>): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(input)) if (value !== undefined) out[key] = value as IDataObject[string];
	return out;
}

export function optionalLocator(ctx: IExecuteFunctions, name: string, i: number): string | undefined {
	const value = ctx.getNodeParameter(name, i, '', { extractValue: true });
	const id = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
	return id === '' ? undefined : id;
}

export function locator(ctx: IExecuteFunctions, name: string, i: number, what = 'a chat'): string {
	const id = optionalLocator(ctx, name, i);
	if (id === undefined) throw new NodeOperationError(ctx.getNode(), `Choose ${what}`, { itemIndex: i });
	return id;
}

export function recipient(ctx: IExecuteFunctions, i: number): IDataObject {
	const sendTo = ctx.getNodeParameter('sendTo', i) as 'phone' | 'chat' | 'group';
	if (sendTo === 'phone') return { to: (ctx.getNodeParameter('phone', i) as string).trim() };
	return { chatId: sendTo === 'group' ? locator(ctx, 'groupId', i, 'a group') : locator(ctx, 'chatId', i) };
}

/** Offset of `timezone` from UTC at `date`, in minutes (no library: Intl only). */
function offsetMinutes(date: Date, timezone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(date);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
	return Math.round((asUtc - date.getTime()) / 60000);
}

/** An ISO time for the API: one without an offset is read in the workflow's time zone. */
export function toIso(value: string, timezone: string): string {
	const trimmed = value.trim();
	const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
	const parsed = new Date(hasOffset ? trimmed : `${trimmed}Z`);
	if (Number.isNaN(parsed.getTime())) throw new Error(`"${value}" is not a date and time (Send At)`);
	if (hasOffset) return parsed.toISOString();
	// Wall-clock time in `timezone`: shift by the zone's offset (twice, for times near a DST change).
	let utc = parsed.getTime() - offsetMinutes(parsed, timezone) * 60000;
	utc = parsed.getTime() - offsetMinutes(new Date(utc), timezone) * 60000;
	return new Date(utc).toISOString();
}

/** `n8n-` + 40 hex: the same for a retry of the same execution, node and item (the API allows 64 characters). */
export function defaultIdempotencyKey(ctx: IExecuteFunctions, i: number): string | undefined {
	const executionId = ctx.getExecutionId();
	if (!executionId) return undefined;
	return `n8n-${createHash('sha256').update(`${executionId}|${ctx.getNode().id}|${i}`).digest('hex').slice(0, 40)}`;
}

interface SendOptionValues {
	idempotencyKey?: string;
	ignoreUnsubscribe?: boolean;
	sendAt?: string;
}

export function sendOptions(ctx: IExecuteFunctions, i: number): { fields: IDataObject; headers: IDataObject } {
	const options = ctx.getNodeParameter('options', i, {}) as SendOptionValues;
	const fields: IDataObject = {};
	if (options.sendAt) {
		try {
			fields.sendAt = toIso(options.sendAt, ctx.getTimezone());
		} catch (error) {
			throw new NodeOperationError(ctx.getNode(), (error as Error).message, { itemIndex: i });
		}
	}
	if (options.ignoreUnsubscribe) fields.ignoreUnsubscribe = true;
	const key = options.idempotencyKey?.trim() || defaultIdempotencyKey(ctx, i);
	return { fields, headers: key ? { 'Idempotency-Key': key } : {} };
}

export function splitList(value: string): string[] {
	return value
		.split(/[\n,;]+/)
		.map((part) => part.trim())
		.filter((part) => part !== '');
}

export function toItems(data: IDataObject | IDataObject[], i: number): INodeExecutionData[] {
	return (Array.isArray(data) ? data : [data]).map((json) => ({ json, pairedItem: { item: i } }));
}

export function success(i: number): INodeExecutionData[] {
	return [{ json: { success: true }, pairedItem: { item: i } }];
}
