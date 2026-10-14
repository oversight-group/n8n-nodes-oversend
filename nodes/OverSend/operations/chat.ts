import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { compact, type Handler, locator, toIso, toItems } from '../helpers';
import { getAll } from '../transport/paginate';
import { apiRequest } from '../transport/request';

const chatPath = (id: string) => `/chats/${encodeURIComponent(id)}`;

interface UpdateFields {
	status?: string;
	assigneeId?: string;
	archived?: boolean;
	pinned?: boolean;
	snoozedUntil?: string;
	clearSnooze?: boolean;
	markUnread?: boolean;
}

export const chatHandlers: Record<string, Handler> = {
	get: async (ctx, i) => toItems(await apiRequest(ctx, 'GET', chatPath(locator(ctx, 'chatId', i))), i),

	getMany: async (ctx, i) => {
		const f = ctx.getNodeParameter('filters', i, {}) as { type?: string; search?: string; status?: string; assigneeId?: string; labelId?: string };
		const qs = compact({
			type: f.type || undefined,
			q: f.search?.trim().slice(0, 100) || undefined,
			status: f.status || undefined,
			assigneeId: f.assigneeId || undefined,
			labelId: f.labelId || undefined,
		});
		const returnAll = ctx.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? 0 : (ctx.getNodeParameter('limit', i) as number);
		return toItems(await getAll(ctx, '/chats', 'chats', qs, returnAll, limit), i);
	},

	update: async (ctx, i) => {
		const id = locator(ctx, 'chatId', i);
		const f = ctx.getNodeParameter('updateFields', i, {}) as UpdateFields;
		const body: IDataObject = compact({
			status: f.status || undefined,
			assigneeId: f.assigneeId === undefined || f.assigneeId === '' ? undefined : f.assigneeId === 'none' ? null : f.assigneeId,
			archived: f.archived,
			pinned: f.pinned,
			snoozedUntil: f.clearSnooze ? null : f.snoozedUntil ? toIso(f.snoozedUntil, ctx.getTimezone()) : undefined,
			unread: f.markUnread ? true : undefined,
		});
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(ctx.getNode(), 'Add at least one field to update', { itemIndex: i });
		}
		return toItems(await apiRequest(ctx, 'PATCH', chatPath(id), { body }), i);
	},

	setLabels: async (ctx, i) =>
		toItems(
			await apiRequest(ctx, 'PUT', `${chatPath(locator(ctx, 'chatId', i))}/labels`, { body: { labelIds: ctx.getNodeParameter('labelIds', i, []) as string[] } }),
			i,
		),

	markRead: async (ctx, i) => toItems(await apiRequest(ctx, 'POST', `${chatPath(locator(ctx, 'chatId', i))}/read`), i),
};
