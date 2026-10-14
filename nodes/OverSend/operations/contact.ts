import type { IDataObject } from 'n8n-workflow';
import { type Handler, splitList, toItems } from '../helpers';
import { apiRequest } from '../transport/request';

const BATCH = 20;

export const contactHandlers: Record<string, Handler> = {
	check: async (ctx, i) => {
		const phones = splitList(ctx.getNodeParameter('phones', i) as string);
		const results: IDataObject[] = [];
		for (let start = 0; start < phones.length; start += BATCH) {
			const page = await apiRequest<{ results: IDataObject[] }>(ctx, 'POST', '/contacts/check', { body: { phones: phones.slice(start, start + BATCH) } });
			results.push(...page.results);
		}
		return toItems(results, i);
	},
};
