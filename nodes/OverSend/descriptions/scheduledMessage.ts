import type { INodeProperties } from 'n8n-workflow';
import { chatLocator, paging } from './shared';

const show = (operation: string[]) => ({ show: { resource: ['scheduledMessage'], operation } });

export const scheduledMessageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['scheduledMessage'] } },
		default: 'getMany',
		options: [
			{ name: 'Cancel', value: 'cancel', action: 'Cancel a scheduled message', description: 'Only messages this API key scheduled' },
			{ name: 'Get', value: 'get', action: 'Get a scheduled message' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many scheduled messages' },
		],
	},
	{ displayName: 'Scheduled Message ID', name: 'scheduledId', type: 'string', default: '', required: true, displayOptions: show(['get', 'cancel']) },
	chatLocator('filterChatId', 'Chat', { resource: ['scheduledMessage'], operation: ['getMany'] }, { required: false, description: "Only this chat's; leave empty for all" }),
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'pending',
		displayOptions: show(['getMany']),
		options: [
			{ name: 'All', value: 'all' },
			{ name: 'Cancelled', value: 'cancelled' },
			{ name: 'Failed', value: 'failed' },
			{ name: 'Pending', value: 'pending' },
			{ name: 'Sent', value: 'sent' },
		],
	},
	...paging('scheduledMessage'),
];
