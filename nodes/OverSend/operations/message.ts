import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { compact, type Handler, optionalLocator, recipient, sendOptions, splitList, toIso, toItems } from '../helpers';
import { templateBody } from '../templates';
import { buildMultipart } from '../transport/multipart';
import { getAll } from '../transport/paginate';
import { apiDownload, apiRequest } from '../transport/request';

async function send(ctx: IExecuteFunctions, i: number, message: IDataObject) {
	const { fields, headers } = sendOptions(ctx, i);
	const result = await apiRequest(ctx, 'POST', '/messages', { body: { ...recipient(ctx, i), ...message, ...fields }, headers });
	return toItems(result, i);
}

const mapped = (value: unknown): Record<string, unknown> =>
	((value as { value?: Record<string, unknown> | null } | undefined)?.value ?? {}) as Record<string, unknown>;

const id = (ctx: IExecuteFunctions, i: number) => encodeURIComponent((ctx.getNodeParameter('messageId', i) as string).trim());

export const messageHandlers: Record<string, Handler> = {
	sendText: (ctx, i) => {
		const extra = ctx.getNodeParameter('textOptions', i, {}) as { replyTo?: string; mentions?: string };
		return send(
			ctx,
			i,
			compact({
				type: 'text',
				text: ctx.getNodeParameter('text', i) as string,
				replyTo: extra.replyTo?.trim() || undefined,
				mentions: extra.mentions ? splitList(extra.mentions) : undefined,
			}),
		);
	},

	sendMedia: (ctx, i) => {
		const extra = ctx.getNodeParameter('mediaOptions', i, {}) as { caption?: string; fileName?: string };
		return send(ctx, i, {
			type: ctx.getNodeParameter('mediaType', i) as string,
			media: compact({
				url: (ctx.getNodeParameter('mediaUrl', i) as string).trim(),
				caption: extra.caption || undefined,
				filename: extra.fileName?.trim() || undefined,
			}),
		});
	},

	sendBinary: async (ctx, i) => {
		const property = ctx.getNodeParameter('binaryPropertyName', i) as string;
		const binary = ctx.helpers.assertBinaryData(i, property);
		const data = await ctx.helpers.getBinaryDataBuffer(i, property);
		const caption = ctx.getNodeParameter('caption', i, '') as string;
		const { fields, headers } = sendOptions(ctx, i);
		const form: Record<string, string> = {};
		for (const [key, value] of Object.entries({ ...recipient(ctx, i), ...(caption && { caption }), ...fields })) {
			form[key] = String(value);
		}
		const { body, contentType } = buildMultipart(form, {
			field: 'file',
			fileName: binary.fileName ?? property,
			mimeType: binary.mimeType || 'application/octet-stream',
			data,
		});
		const result = await apiRequest(ctx, 'POST', '/messages/media', { body, headers: { ...headers, 'Content-Type': contentType } });
		return toItems(result, i);
	},

	sendTemplate: (ctx, i) =>
		send(ctx, i, {
			type: 'template',
			template: templateBody(ctx.getNodeParameter('template', i) as string, mapped(ctx.getNodeParameter('templateFields', i, {}))),
		}),

	sendLocation: (ctx, i) => {
		const extra = ctx.getNodeParameter('locationOptions', i, {}) as { name?: string; address?: string };
		return send(ctx, i, {
			type: 'location',
			location: compact({
				latitude: ctx.getNodeParameter('latitude', i) as number,
				longitude: ctx.getNodeParameter('longitude', i) as number,
				name: extra.name?.trim() || undefined,
				address: extra.address?.trim() || undefined,
			}),
		});
	},

	sendContacts: (ctx, i) => {
		const rows = (ctx.getNodeParameter('contacts', i, {}) as { contact?: Array<{ name: string; phone: string }> }).contact ?? [];
		return send(ctx, i, { type: 'contact', contacts: rows.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })) });
	},

	sendPoll: (ctx, i) => {
		const options = (ctx.getNodeParameter('pollOptions', i, []) as string[]).map((o) => o.trim()).filter((o) => o !== '');
		return send(ctx, i, {
			type: 'poll',
			poll: { question: ctx.getNodeParameter('question', i) as string, options, multiple: ctx.getNodeParameter('multipleAnswers', i, false) as boolean },
		});
	},

	get: async (ctx, i) => toItems(await apiRequest(ctx, 'GET', `/messages/${id(ctx, i)}`), i),

	getMany: async (ctx, i) => {
		const filters = ctx.getNodeParameter('filters', i, {}) as { direction?: string; since?: string; receivedSince?: string };
		const timezone = ctx.getTimezone();
		const qs = compact({
			chatId: optionalLocator(ctx, 'filterChatId', i),
			direction: filters.direction || undefined,
			since: filters.since ? toIso(filters.since, timezone) : undefined,
			receivedSince: filters.receivedSince ? toIso(filters.receivedSince, timezone) : undefined,
		});
		const returnAll = ctx.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? 0 : (ctx.getNodeParameter('limit', i) as number);
		return toItems(await getAll(ctx, '/messages', 'messages', qs, returnAll, limit), i);
	},

	downloadMedia: async (ctx, i) => {
		const messageId = ctx.getNodeParameter('messageId', i) as string;
		const property = ctx.getNodeParameter('binaryPropertyName', i) as string;
		const file = await apiDownload(ctx, `/messages/${encodeURIComponent(messageId.trim())}/media`);
		const binary = await ctx.helpers.prepareBinaryData(file.data, file.fileName, file.mimeType);
		return [
			{
				json: { messageId: messageId.trim(), fileName: file.fileName ?? null, mimeType: file.mimeType, size: file.data.length },
				binary: { [property]: binary },
				pairedItem: { item: i },
			},
		];
	},

	react: async (ctx, i) =>
		toItems(await apiRequest(ctx, 'PUT', `/messages/${id(ctx, i)}/reaction`, { body: { emoji: (ctx.getNodeParameter('emoji', i, '') as string).trim() } }), i),

	edit: async (ctx, i) =>
		toItems(await apiRequest(ctx, 'PATCH', `/messages/${id(ctx, i)}`, { body: { text: ctx.getNodeParameter('newText', i) as string } }), i),

	delete: async (ctx, i) => {
		const result = await apiRequest(ctx, 'DELETE', `/messages/${id(ctx, i)}`);
		const empty = !result || Object.keys(result).length === 0;
		return empty ? [{ json: { id: (ctx.getNodeParameter('messageId', i) as string).trim(), deleted: true }, pairedItem: { item: i } }] : toItems(result, i);
	},

	vote: async (ctx, i) => {
		const options = (ctx.getNodeParameter('voteOptions', i, []) as string[]).map((o) => o.trim()).filter((o) => o !== '');
		return toItems(await apiRequest(ctx, 'PUT', `/messages/${id(ctx, i)}/vote`, { body: { options } }), i);
	},
};
