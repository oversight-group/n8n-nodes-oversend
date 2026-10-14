import type { IDataObject } from 'n8n-workflow';
import { apiRequest, type ApiContext } from './request';

/** Follows `nextCursor` until all, or `limit`, entries of `key` are read. */
export async function getAll(
	ctx: ApiContext,
	path: string,
	key: string,
	qs: IDataObject,
	returnAll: boolean,
	limit: number,
	pageMax = 100,
): Promise<IDataObject[]> {
	const out: IDataObject[] = [];
	let cursor: string | undefined;
	do {
		const size = returnAll ? pageMax : Math.min(pageMax, limit - out.length);
		const page = await apiRequest<IDataObject>(ctx, 'GET', path, {
			qs: { ...qs, limit: size, ...(cursor !== undefined && { cursor }) },
		});
		const entries = Array.isArray(page[key]) ? (page[key] as IDataObject[]) : [];
		out.push(...entries);
		cursor = typeof page.nextCursor === 'string' && page.nextCursor !== '' ? page.nextCursor : undefined;
	} while (cursor !== undefined && (returnAll || out.length < limit));
	return returnAll ? out : out.slice(0, limit);
}
