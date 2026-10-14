import type { INodeProperties } from 'n8n-workflow';

export const contactDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		default: 'check',
		options: [{ name: 'Check WhatsApp', value: 'check', action: 'Check which numbers are registered', description: 'WhatsApp Web numbers only' }],
	},
	{
		displayName: 'Phone Numbers',
		name: 'phones',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		placeholder: '+972501234567, +972527654321',
		description: 'Separated by commas or new lines. Outputs one item per number.',
		displayOptions: { show: { resource: ['contact'], operation: ['check'] } },
	},
];
