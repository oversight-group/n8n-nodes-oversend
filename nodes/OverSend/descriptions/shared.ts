import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

export const SEND_OPERATIONS = ['sendText', 'sendMedia', 'sendBinary', 'sendTemplate', 'sendLocation', 'sendContacts', 'sendPoll'];

export function chatLocator(
	name: string,
	displayName: string,
	show: IDisplayOptions['show'],
	options: { groupsOnly?: boolean; required?: boolean; description?: string } = {},
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: options.required ?? true,
		description: options.description,
		displayOptions: { show },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: options.groupsOnly ? 'searchGroups' : 'searchChats', searchable: true },
			},
			{ displayName: 'By ID', name: 'id', type: 'string', placeholder: 'cmh1x2y3z0000abcd' },
		],
	};
}

const sends = { resource: ['message'], operation: SEND_OPERATIONS };

export const recipientFields: INodeProperties[] = [
	{
		displayName: 'Send To',
		name: 'sendTo',
		type: 'options',
		noDataExpression: true,
		default: 'phone',
		displayOptions: { show: sends },
		options: [
			{ name: 'Chat', value: 'chat', description: 'Any chat the company already has, with a person or a group' },
			{ name: 'Group', value: 'group', description: 'A WhatsApp group the number is in' },
			{ name: 'Phone Number', value: 'phone', description: 'A person, by their number' },
		],
	},
	{
		displayName: 'Phone Number',
		name: 'phone',
		type: 'string',
		default: '',
		required: true,
		placeholder: '+972501234567',
		description: 'With the country code. Spaces, dashes and + are fine.',
		displayOptions: { show: { ...sends, sendTo: ['phone'] } },
	},
	chatLocator('chatId', 'Chat', { ...sends, sendTo: ['chat'] }),
	chatLocator('groupId', 'Group', { ...sends, sendTo: ['group'] }, { groupsOnly: true }),
];

export const sendOptionsField: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: { show: sends },
	options: [
		{
			displayName: 'Idempotency Key',
			name: 'idempotencyKey',
			type: 'string',
			default: '',
			description:
				'Sending again with the same key returns the first message instead of a second one. By default each execution, run and item gets its own key, so a retry never sends twice.',
		},
		{
			displayName: 'Ignore Unsubscribe',
			name: 'ignoreUnsubscribe',
			type: 'boolean',
			default: false,
			description: 'Whether to send even if the contact unsubscribed. Use it only for messages they asked for, such as a code or a receipt.',
		},
		{
			displayName: 'Send At',
			name: 'sendAt',
			type: 'dateTime',
			default: '',
			description:
				"Schedule the message instead of sending it now (at most a year ahead). A time without an offset is read in the workflow's time zone. The output is then the scheduled message.",
		},
	],
};

export function paging(resource: string, operation = 'getMany'): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: { resource: [resource], operation: [operation] } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1 },
			description: 'Max number of results to return',
			displayOptions: { show: { resource: [resource], operation: [operation], returnAll: [false] } },
		},
	];
}
