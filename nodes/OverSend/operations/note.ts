import { type Handler, locator, success, toItems } from '../helpers';
import { apiRequest } from '../transport/request';
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

const notes = (ctx: IExecuteFunctions, i: number) => `/chats/${encodeURIComponent(locator(ctx, 'chatId', i))}/notes`;
const note = (ctx: IExecuteFunctions, i: number) => `${notes(ctx, i)}/${encodeURIComponent((ctx.getNodeParameter('noteId', i) as string).trim())}`;

export const noteHandlers: Record<string, Handler> = {
	create: async (ctx, i) => toItems(await apiRequest(ctx, 'POST', notes(ctx, i), { body: { body: ctx.getNodeParameter('body', i) as string } }), i),
	getMany: async (ctx, i) => toItems(((await apiRequest(ctx, 'GET', notes(ctx, i))).notes as IDataObject[]) ?? [], i),
	update: async (ctx, i) => toItems(await apiRequest(ctx, 'PATCH', note(ctx, i), { body: { body: ctx.getNodeParameter('body', i) as string } }), i),
	delete: async (ctx, i) => {
		await apiRequest(ctx, 'DELETE', note(ctx, i));
		return success(i);
	},
};
