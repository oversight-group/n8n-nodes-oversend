import type { INodeProperties } from 'n8n-workflow';
import { chatLocator } from './shared';

const show = (operation: string[]) => ({ show: { resource: ['note'], operation } });

export const noteDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['note'] } },
		default: 'create',
		options: [
			{ name: 'Create', value: 'create', action: 'Add a note to a chat', description: "The team's own note, never sent to WhatsApp" },
			{ name: 'Delete', value: 'delete', action: 'Delete a note' },
			{ name: 'Get Many', value: 'getMany', action: 'Get the notes of a chat' },
			{ name: 'Update', value: 'update', action: 'Edit a note' },
		],
	},
	chatLocator('chatId', 'Chat', { resource: ['note'] }),
	{ displayName: 'Note ID', name: 'noteId', type: 'string', default: '', required: true, displayOptions: show(['update', 'delete']) },
	{ displayName: 'Text', name: 'body', type: 'string', typeOptions: { rows: 4 }, default: '', required: true, displayOptions: show(['create', 'update']) },
];
