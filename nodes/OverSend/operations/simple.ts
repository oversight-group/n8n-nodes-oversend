import type { IDataObject } from 'n8n-workflow';
import { type Handler, toItems } from '../helpers';
import { apiRequest } from '../transport/request';

const list = (path: string, key: string): Handler => async (ctx, i) => toItems(((await apiRequest(ctx, 'GET', path))[key] as IDataObject[]) ?? [], i);

export const labelHandlers: Record<string, Handler> = { getMany: list('/labels', 'labels') };
export const memberHandlers: Record<string, Handler> = { getMany: list('/members', 'members') };
export const templateHandlers: Record<string, Handler> = { getMany: list('/templates', 'templates') };
export const instanceHandlers: Record<string, Handler> = {
	getStatus: async (ctx, i) => toItems(await apiRequest(ctx, 'GET', '/instance'), i),
};
