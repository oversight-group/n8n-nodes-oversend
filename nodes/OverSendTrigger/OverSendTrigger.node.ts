import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
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

/**
 * One entry per webhook URL: n8n shares a node's static data between the production URL and the
 * "Listen for test event" URL, and each URL has its own OverSend webhook and secret.
 */
type StoredWebhooks = Record<string, { id?: string; secret?: string } | undefined>;

const storedFor = (data: IDataObject, url: string) => (data.webhooks as StoredWebhooks | undefined)?.[url];

/** Removes this URL's entry (and the map itself once empty). Other URLs' entries stay. */
function forget(data: IDataObject, url: string): void {
	const webhooks = data.webhooks as StoredWebhooks | undefined;
	if (!webhooks) return;
	delete webhooks[url];
	if (Object.keys(webhooks).length === 0) delete data.webhooks;
}

/** Earlier versions kept one `webhookId` / `secret` pair: its URL is unknown, so it is dropped, never matched. */
function forgetLegacy(data: IDataObject): void {
	delete data.webhookId;
	delete data.secret;
}

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
				forgetLegacy(data);
				const url = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const { webhooks } = await apiRequest<{ webhooks: ApiWebhook[] }>(this, 'GET', '/webhooks');
				const mine = storedFor(data, url);
				const found = mine && webhooks.find((w) => w.id === mine.id);
				if (mine && mine.secret && found && found.url === url && sameEvents(found.events, events)) return true;
				// Gone, changed, or its secret lost: remove this key's leftovers at this URL only, so create() starts clean.
				// Other URLs (the production URL while listening on the test URL, or the reverse) are never touched.
				for (const w of webhooks.filter((w) => w.url === url)) {
					// A webhook that is already gone counts as removed; any other error stops the activation.
					const failure = await apiRequest(this, 'DELETE', `/webhooks/${encodeURIComponent(w.id)}`).then(
						() => undefined,
						(error: unknown) => (isNotFound(error) ? undefined : error),
					);
					if (failure) throw failure;
				}
				forget(data, url);
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const answer = await apiRequest<{ webhook?: ApiWebhook; secret?: string }>(this, 'POST', '/webhooks', { body: { url, events } });
				const id = answer?.webhook?.id;
				const secret = answer?.secret;
				if (typeof id !== 'string' || id === '' || typeof secret !== 'string' || secret === '') {
					throw new NodeOperationError(this.getNode(), 'OverSend did not return the new webhook id and secret', {
						description: 'Try again, and check that the OverSend server supports webhooks',
					});
				}
				const data = this.getWorkflowStaticData('node');
				forgetLegacy(data);
				const webhooks = (data.webhooks ?? {}) as StoredWebhooks;
				webhooks[url] = { id, secret };
				data.webhooks = webhooks;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				forgetLegacy(data);
				const url = this.getNodeWebhookUrl('default') as string;
				const mine = storedFor(data, url);
				if (mine?.id) {
					try {
						await apiRequest(this, 'DELETE', `/webhooks/${encodeURIComponent(mine.id)}`);
					} catch (error) {
						if (!isNotFound(error)) return false;
					}
				}
				forget(data, url);
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
		// The test and production URLs share static data, so a delivery may be signed with any stored secret.
		const secrets = Object.values((data.webhooks ?? {}) as StoredWebhooks)
			.map((entry) => entry?.secret)
			.filter((secret): secret is string => typeof secret === 'string' && secret !== '');
		if (!secrets.some((secret) => verifySignature(secret, header, raw))) {
			this.getResponseObject().status(401).send('Invalid signature').end();
			return { noWebhookResponse: true };
		}
		let event: OverSendEvent;
		try {
			event = JSON.parse(raw) as OverSendEvent;
		} catch {
			// Signed but not JSON: acknowledge so OverSend does not retry, start nothing.
			return {};
		}
		const options = this.getNodeParameter('options', {}) as TriggerOptions;
		if (event.type === 'test.ping' || !passes(event, this.getNodeParameter('events') as string[], options)) return {};
		return { workflowData: [[{ json: (options.output === 'data' ? event.data : event) as IDataObject }]] };
	}
}
