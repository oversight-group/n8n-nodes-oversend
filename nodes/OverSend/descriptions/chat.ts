import type { INodeProperties } from 'n8n-workflow';
import { chatLocator, paging } from './shared';

const show = (operation: string[]) => ({ show: { resource: ['chat'], operation } });
const STATUS = [
	{ name: 'Done', value: 'done' },
	{ name: 'Open', value: 'open', description: 'Needs the team' },
	{ name: 'Pending', value: 'pending', description: 'Waiting for the customer' },
];

export const chatDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chat'] } },
		default: 'getMany',
		options: [
			{ name: 'Get', value: 'get', action: 'Get a chat' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many chats' },
			{ name: 'Mark Read', value: 'markRead', action: 'Mark a chat read' },
			{ name: 'Set Labels', value: 'setLabels', action: 'Set the labels of a chat' },
			{ name: 'Update', value: 'update', action: 'Update a chat', description: 'Status, assignee, archive, pin, snooze or unread' },
		],
	},
	chatLocator('chatId', 'Chat', { resource: ['chat'], operation: ['get', 'update', 'setLabels', 'markRead'] }),
	...paging('chat'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getMany']),
		options: [
			{
				displayName: 'Assignee Name or ID',
				name: 'assigneeId',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'getMembersOrNone' },
			},
			{
				displayName: 'Label Name or ID',
				name: 'labelId',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'getLabels' },
			},
			{ displayName: 'Search', name: 'search', type: 'string', default: '', description: 'Part of the group subject, the contact name or the phone number' },
			{ displayName: 'Status', name: 'status', type: 'options', default: 'open', options: STATUS },
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'group',
				options: [
					{ name: 'Direct', value: 'direct', description: 'Chats with one person' },
					{ name: 'Group', value: 'group' },
				],
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			{ displayName: 'Archived', name: 'archived', type: 'boolean', default: true, description: 'Whether the chat is archived (archiving also unpins it)' },
			{
				displayName: 'Assignee Name or ID',
				name: 'assigneeId',
				type: 'options',
				default: '',
				description: 'Choose "Unassigned" to remove the assignee. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getMembersOrNone' },
			},
			{ displayName: 'Bring Back From Snooze', name: 'clearSnooze', type: 'boolean', default: true, description: 'Whether to end a snooze now' },
			{ displayName: 'Mark Unread', name: 'markUnread', type: 'boolean', default: true, description: 'Whether to mark the chat unread (use Mark Read to mark it read)' },
			{ displayName: 'Pinned', name: 'pinned', type: 'boolean', default: true, description: 'Whether the chat is pinned (at most 3 per company)' },
			{ displayName: 'Snooze Until', name: 'snoozedUntil', type: 'dateTime', default: '', description: 'Out of the inbox until then (at most a year ahead)' },
			{ displayName: 'Status', name: 'status', type: 'options', default: 'done', options: STATUS },
		],
	},
	{
		displayName: 'Label Names or IDs',
		name: 'labelIds',
		type: 'multiOptions',
		default: [],
		description: 'The chat gets exactly these labels; none removes them all. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: { loadOptionsMethod: 'getLabels' },
		displayOptions: show(['setLabels']),
	},
];
