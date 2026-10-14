import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { apiRequest, isNotFound } from '../OverSend/transport/request';
import { passes, WEBHOOK_EVENTS, type OverSendEvent, type TriggerOptions } from './filters';
import { verifySignature } from './signature';

const MAIN_CONNECTION: NodeConnectionType = NodeConnectionTypes?.Main ?? 'main';

const EVENT_NAMES: Record<string, string> = {
	'message.received': 'Message Received',
	'message.status': 'Message Status (sent, delivered, read, failed)',
	'message.edited': 'Message Edited',
	'message.deleted': 'Message Deleted',
	'message.reaction': 'Message Reaction',
	'message.poll_votes': 'Poll Votes Changed',
	'chat.updated': 'Chat Updated (status, assignee, labels...)',
	'scheduled_message.status': 'Scheduled Message Sent, Failed or Cancelled',
	'instance.status': 'WhatsApp Connection Changed',
	'contact.unsubscribed': 'Contact Unsubscribed',
	'contact.resubscribed': 'Contact Resubscribed',
};

interface ApiWebhook {
	id: string;
	url: string;
	events: string[];
}

const sameEvents = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export class OverSendTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OverSend Trigger',
		name: 'overSendTrigger',
		icon: { light: 'file:oversend.svg', dark: 'file:oversend.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in OverSend',
		defaults: { name: 'OverSend Trigger' },
		inputs: [],
		outputs: [MAIN_CONNECTION],
		credentials: [{ name: 'overSendApi', required: true }],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['message.received'],
				description: 'The API key needs "webhooks:manage", plus "messages:read" for message events and "chats:read" for chat and contact events',
				options: [...WEBHOOK_EVENTS].sort().map((value) => ({ name: EVENT_NAMES[value], value })),
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Chat Type',
						name: 'chatType',
						type: 'options',
						default: 'all',
						description: 'Message and chat events only',
						options: [
							{ name: 'All Chats', value: 'all' },
							{ name: 'Direct Chats Only', value: 'direct' },
							{ name: 'Groups Only', value: 'group' },
						],
					},
					{
						displayName: 'Direction',
						name: 'direction',
						type: 'options',
						default: 'all',
						description: 'Message events only',
						options: [
							{ name: 'All', value: 'all' },
							{ name: 'Inbound (From Customers)', value: 'inbound' },
							{ name: 'Outbound (From the Company)', value: 'outbound' },
						],
					},
					{
						displayName: 'Output',
						name: 'output',
						type: 'options',
						default: 'full',
						options: [
							{ name: 'Full Event', value: 'full', description: 'ID, type, time, company and data' },
							{ name: 'Data Only', value: 'data', description: 'The message, chat or contact itself' },
						],
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const url = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const { webhooks } = await apiRequest<{ webhooks: ApiWebhook[] }>(this, 'GET', '/webhooks');
				const mine = webhooks.find((w) => w.id === data.webhookId);
				if (mine && data.secret && mine.url === url && sameEvents(mine.events, events)) return true;
				// Gone, changed, or its secret lost: remove this key's leftovers at this URL so create() starts clean.
				for (const w of webhooks.filter((w) => w.id === data.webhookId || w.url === url)) {
					try {
						await apiRequest(this, 'DELETE', `/webhooks/${encodeURIComponent(w.id)}`);
					} catch (error) {
						if (!isNotFound(error)) throw error;
					}
				}
				delete data.webhookId;
				delete data.secret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const { webhook, secret } = await apiRequest<{ webhook: ApiWebhook; secret: string }>(this, 'POST', '/webhooks', { body: { url, events } });
				const data = this.getWorkflowStaticData('node');
				data.webhookId = webhook.id;
				data.secret = secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.webhookId) {
					try {
						await apiRequest(this, 'DELETE', `/webhooks/${encodeURIComponent(data.webhookId as string)}`);
					} catch (error) {
						if (!isNotFound(error)) return false;
					}
				}
				delete data.webhookId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const data = this.getWorkflowStaticData('node');
		const request = this.getRequestObject() as unknown as { rawBody?: Buffer };
		// OverSend signs the exact text it sends; JSON.stringify of the parsed body gives the same text.
		const raw = request.rawBody ? request.rawBody.toString('utf8') : JSON.stringify(this.getBodyData());
		const header = this.getHeaderData()['x-oversend-signature'] as string | undefined;
		if (typeof data.secret !== 'string' || !verifySignature(data.secret, header, raw)) {
			this.getResponseObject().status(401).send('Invalid signature').end();
			return { noWebhookResponse: true };
		}
		const event = JSON.parse(raw) as OverSendEvent;
		const options = this.getNodeParameter('options', {}) as TriggerOptions;
		if (event.type === 'test.ping' || !passes(event, this.getNodeParameter('events') as string[], options)) return {};
		return { workflowData: [[{ json: (options.output === 'data' ? event.data : event) as IDataObject }]] };
	}
}
