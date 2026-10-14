import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { compact, type Handler, recipient, sendOptions, splitList, toItems } from '../helpers';
import { templateBody } from '../templates';
import { buildMultipart } from '../transport/multipart';
import { apiRequest } from '../transport/request';

async function send(ctx: IExecuteFunctions, i: number, message: IDataObject) {
	const { fields, headers } = sendOptions(ctx, i);
	const result = await apiRequest(ctx, 'POST', '/messages', { body: { ...recipient(ctx, i), ...message, ...fields }, headers });
	return toItems(result, i);
}

const mapped = (value: unknown): Record<string, unknown> =>
	((value as { value?: Record<string, unknown> | null } | undefined)?.value ?? {}) as Record<string, unknown>;

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
};
