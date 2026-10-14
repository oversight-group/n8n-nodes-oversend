import type { INodeProperties } from 'n8n-workflow';

const only = (resource: string, value: string, name: string, action: string): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	default: value,
	options: [{ name, value, action }],
});

export const simpleDescriptions: INodeProperties[] = [
	only('label', 'getMany', 'Get Many', 'Get labels'),
	only('member', 'getMany', 'Get Many', 'Get team members'),
	only('template', 'getMany', 'Get Many', 'Get templates'),
	only('instance', 'getStatus', 'Get Status', 'Get the WhatsApp connection status'),
];
