import type { IDataObject, ILoadOptionsFunctions, INodeListSearchItems, INodeListSearchResult } from 'n8n-workflow';
import { apiRequest } from '../transport/request';
import type { ApiChat } from '../types';

export function chatResult(chat: ApiChat): INodeListSearchItems {
	const phone = chat.phone ? `+${chat.phone}` : null;
	if (chat.type === 'group') return { name: `${chat.name ?? chat.id} (group)`, value: chat.id };
	if (chat.name && phone) return { name: `${chat.name} (${phone})`, value: chat.id };
	return { name: chat.name ?? phone ?? chat.id, value: chat.id };
}

async function search(ctx: ILoadOptionsFunctions, filter: string | undefined, cursor: string | undefined, type?: 'group') {
	const q = filter?.trim().slice(0, 100);
	const qs: IDataObject = { ...(q && { q }), ...(type && { type }), limit: 50, ...(cursor && { cursor }) };
	const page = await apiRequest<{ chats: ApiChat[]; nextCursor: string | null }>(ctx, 'GET', '/chats', { qs });
	const result: INodeListSearchResult = { results: page.chats.map(chatResult), paginationToken: page.nextCursor ?? undefined };
	return result;
}

export const listSearch = {
	async searchChats(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		return search(this, filter, paginationToken);
	},
	async searchGroups(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		return search(this, filter, paginationToken, 'group');
	},
};
