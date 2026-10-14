import { compact, type Handler, splitList, success, toItems } from '../helpers';
import { getAll } from '../transport/paginate';
import { apiRequest } from '../transport/request';

export const unsubscribeHandlers: Record<string, Handler> = {
	add: async (ctx, i) => {
		const note = (ctx.getNodeParameter('note', i, '') as string).trim();
		const body = compact({ phones: splitList(ctx.getNodeParameter('phones', i) as string), note: note || undefined });
		return toItems(await apiRequest(ctx, 'POST', '/unsubscribes', { body }), i);
	},
	getMany: async (ctx, i) => {
		const phone = ((ctx.getNodeParameter('filters', i, {}) as { phone?: string }).phone ?? '').trim();
		const returnAll = ctx.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? 0 : (ctx.getNodeParameter('limit', i) as number);
		return toItems(await getAll(ctx, '/unsubscribes', 'unsubscribes', compact({ phone: phone || undefined }), returnAll, limit, 200), i);
	},
	remove: async (ctx, i) => {
		await apiRequest(ctx, 'DELETE', `/unsubscribes/${encodeURIComponent((ctx.getNodeParameter('phone', i) as string).trim())}`);
		return success(i);
	},
};
