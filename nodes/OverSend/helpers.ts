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
	if (typeof value !== 'string') throw new Error(`"${String(value)}" is not a date and time (Send At)`);
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

/** n8n's run index of this node (0 on the first pass, 1 on the next, as in a loop); 0 when it cannot be read. */
function runIndex(ctx: IExecuteFunctions, i: number): number {
	try {
		const value = ctx.getWorkflowDataProxy(i).$runIndex;
		return typeof value === 'number' && Number.isFinite(value) ? value : 0;
	} catch {
		return 0;
	}
}

/** Reads a string from n8n; '' when it is missing or the call throws (older or stripped-down contexts). */
function readString(read: () => unknown): string {
	try {
		const value = read();
		return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
	} catch {
		return '';
	}
}

/**
 * `n8n-` + 40 hex: the same for a retry of the same instance, workflow, execution, node, run and item (Retry On Fail
 * stays in one run), different for each pass of a loop (the API allows 64 characters). OverSend keeps keys per company
 * forever, and execution ids are per-instance counters while node ids survive export and import, so the n8n instance and
 * the workflow are part of the key: staging and production, or a reset n8n, never reuse each other's keys.
 */
export function defaultIdempotencyKey(ctx: IExecuteFunctions, i: number): string | undefined {
	const executionId = ctx.getExecutionId();
	if (!executionId) return undefined;
	const instanceId = readString(() => ctx.getInstanceId());
	const workflowId = readString(() => ctx.getWorkflow().id);
	const material = `${instanceId}|${workflowId}|${executionId}|${ctx.getNode().id}|${runIndex(ctx, i)}|${i}`;
	return `n8n-${createHash('sha256').update(material).digest('hex').slice(0, 40)}`;
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
