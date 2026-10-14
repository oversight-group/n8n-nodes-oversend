import type { INodeProperties } from 'n8n-workflow';
import { chatDescription } from './chat';
import { contactDescription } from './contact';
import { messageDescription } from './message';
import { noteDescription } from './note';
import { scheduledMessageDescription } from './scheduledMessage';
import { simpleDescriptions } from './simple';
import { unsubscribeDescription } from './unsubscribe';

const resource: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	default: 'message',
	options: [
		{ name: 'Chat', value: 'chat' },
		{ name: 'Contact', value: 'contact' },
		{ name: 'Instance', value: 'instance' },
		{ name: 'Label', value: 'label' },
		{ name: 'Member', value: 'member' },
		{ name: 'Message', value: 'message' },
		{ name: 'Note', value: 'note' },
		{ name: 'Scheduled Message', value: 'scheduledMessage' },
		{ name: 'Template', value: 'template' },
		{ name: 'Unsubscribe', value: 'unsubscribe' },
	],
};

export const properties: INodeProperties[] = [
	resource,
	...messageDescription,
	...chatDescription,
	...noteDescription,
	...scheduledMessageDescription,
	...contactDescription,
	...unsubscribeDescription,
	...simpleDescriptions,
];
