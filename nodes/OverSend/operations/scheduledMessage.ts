import type { IExecuteFunctions } from 'n8n-workflow';
import { compact, type Handler, optionalLocator, toItems } from '../helpers';
import { getAll } from '../transport/paginate';
import { apiRequest } from '../transport/request';

const one = (ctx: IExecuteFunctions, i: number) => `/scheduled-messages/${encodeURIComponent((ctx.getNodeParameter('scheduledId', i) as string).trim())}`;

export const scheduledMessageHandlers: Record<string, Handler> = {
	get: async (ctx, i) => toItems(await apiRequest(ctx, 'GET', one(ctx, i)), i),
	getMany: async (ctx, i) => {
		const qs = compact({ chatId: optionalLocator(ctx, 'filterChatId', i), status: ctx.getNodeParameter('status', i, 'pending') as string });
		const returnAll = ctx.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? 0 : (ctx.getNodeParameter('limit', i) as number);
		return toItems(await getAll(ctx, '/scheduled-messages', 'scheduled', qs, returnAll, limit), i);
	},
	cancel: async (ctx, i) => toItems(await apiRequest(ctx, 'DELETE', one(ctx, i)), i),
};
