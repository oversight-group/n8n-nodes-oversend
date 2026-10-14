import type { INodeProperties } from 'n8n-workflow';
import { paging } from './shared';

const show = (operation: string[]) => ({ show: { resource: ['unsubscribe'], operation } });

export const unsubscribeDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['unsubscribe'] } },
		default: 'add',
		options: [
			{ name: 'Add', value: 'add', action: 'Unsubscribe numbers from automated messages' },
			{ name: 'Get Many', value: 'getMany', action: 'Get unsubscribed contacts' },
			{ name: 'Remove', value: 'remove', action: 'Subscribe a number again' },
		],
	},
	{ displayName: 'Phone Numbers', name: 'phones', type: 'string', typeOptions: { rows: 3 }, default: '', required: true, description: 'Up to 1000, separated by commas or new lines', displayOptions: show(['add']) },
	{ displayName: 'Note', name: 'note', type: 'string', default: '', description: 'Why, for your records (shown in OverSend)', displayOptions: show(['add']) },
	{ displayName: 'Phone Number', name: 'phone', type: 'string', default: '', required: true, displayOptions: show(['remove']) },
	...paging('unsubscribe'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getMany']),
		options: [{ displayName: 'Phone Number', name: 'phone', type: 'string', default: '', description: 'Only this number: tells you whether it is unsubscribed' }],
	},
];
