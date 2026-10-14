import type { INodeProperties } from 'n8n-workflow';
import { chatLocator, paging, recipientFields, sendOptionsField } from './shared';

const show = (operation: string[]) => ({ show: { resource: ['message'], operation } });

export const messageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		default: 'sendText',
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a message for everyone', description: 'WhatsApp Web numbers; only messages this API key sent' },
			{ name: 'Download Media', value: 'downloadMedia', action: 'Download the file of a message' },
			{ name: 'Edit', value: 'edit', action: 'Edit a text message', description: 'WhatsApp Web numbers; only messages this API key sent' },
			{ name: 'Get', value: 'get', action: 'Get a message' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many messages' },
			{ name: 'React', value: 'react', action: 'React to a message' },
			{ name: 'Send Contact Cards', value: 'sendContacts', action: 'Send contact cards' },
			{ name: 'Send File', value: 'sendBinary', action: 'Send a file from the workflow', description: 'Upload binary data from an earlier node' },
			{ name: 'Send Location', value: 'sendLocation', action: 'Send a location' },
			{ name: 'Send Media by URL', value: 'sendMedia', action: 'Send an image video audio or document by URL' },
			{ name: 'Send Poll', value: 'sendPoll', action: 'Send a poll', description: 'WhatsApp Web numbers only' },
			{ name: 'Send Template', value: 'sendTemplate', action: 'Send a template' },
			{ name: 'Send Text', value: 'sendText', action: 'Send a text message' },
			{ name: 'Vote', value: 'vote', action: 'Vote in a poll', description: 'WhatsApp Web numbers only' },
		],
	},
	...recipientFields,

	// Send Text
	{ displayName: 'Text', name: 'text', type: 'string', typeOptions: { rows: 4 }, default: '', required: true, displayOptions: show(['sendText']) },
	{
		displayName: 'Text Options',
		name: 'textOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['sendText']),
		options: [
			{
				displayName: 'Mentions',
				name: 'mentions',
				type: 'string',
				default: '',
				placeholder: '972501234567, 972527654321',
				description: 'Groups: numbers to @mention, separated by commas. Each must appear in the text as @ and its digits.',
			},
			{ displayName: 'Reply To Message ID', name: 'replyTo', type: 'string', default: '', description: 'Quote this message (it must be in the same chat)' },
		],
	},

	// Send Media by URL
	{
		displayName: 'Media Type',
		name: 'mediaType',
		type: 'options',
		default: 'image',
		displayOptions: show(['sendMedia']),
		options: [
			{ name: 'Audio', value: 'audio' },
			{ name: 'Document', value: 'document' },
			{ name: 'Image', value: 'image' },
			{ name: 'Video', value: 'video' },
		],
	},
	{ displayName: 'URL', name: 'mediaUrl', type: 'string', default: '', required: true, placeholder: 'https://example.com/invoice.pdf', description: 'A public http(s) address OverSend downloads the file from', displayOptions: show(['sendMedia']) },
	{
		displayName: 'Media Options',
		name: 'mediaOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['sendMedia']),
		options: [
			{ displayName: 'Caption', name: 'caption', type: 'string', default: '', description: 'Shown under images, videos and documents' },
			{ displayName: 'File Name', name: 'fileName', type: 'string', default: '', description: "Documents: the name the customer sees. Defaults to the URL's last part." },
		],
	},

	// Send File
	{ displayName: 'Input Binary Field', name: 'binaryPropertyName', type: 'string', default: 'data', required: true, description: 'The binary field of the input item that holds the file', displayOptions: show(['sendBinary']) },
	{ displayName: 'Caption', name: 'caption', type: 'string', default: '', displayOptions: show(['sendBinary']) },

	// Send Template
	{
		displayName: 'Template Name or ID',
		name: 'template',
		type: 'options',
		default: '',
		required: true,
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		hint: 'In an expression: meta|LANGUAGE|NAME for a Meta template (for example meta|he|order_update), quick||NAME for a WhatsApp Web quick template',
		typeOptions: { loadOptionsMethod: 'getTemplates' },
		displayOptions: show(['sendTemplate']),
	},
	{
		displayName: 'Template Fields',
		name: 'templateFields',
		type: 'resourceMapper',
		noDataExpression: true,
		default: { mappingMode: 'defineBelow', value: null },
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['template'],
			resourceMapper: {
				resourceMapperMethod: 'getTemplateFields',
				mode: 'add',
				fieldWords: { singular: 'field', plural: 'fields' },
				addAllFields: true,
				multiKeyMatch: false,
			},
		},
		displayOptions: show(['sendTemplate']),
	},

	// Send Location
	{ displayName: 'Latitude', name: 'latitude', type: 'number', typeOptions: { minValue: -90, maxValue: 90, numberPrecision: 6 }, default: 0, required: true, displayOptions: show(['sendLocation']) },
	{ displayName: 'Longitude', name: 'longitude', type: 'number', typeOptions: { minValue: -180, maxValue: 180, numberPrecision: 6 }, default: 0, required: true, displayOptions: show(['sendLocation']) },
	{
		displayName: 'Location Options',
		name: 'locationOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['sendLocation']),
		options: [
			{ displayName: 'Address', name: 'address', type: 'string', default: '' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: "The place's name, such as Our office" },
		],
	},

	// Send Contact Cards
	{
		displayName: 'Contacts',
		name: 'contacts',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Contact',
		description: 'Up to 10 contact cards',
		displayOptions: show(['sendContacts']),
		options: [
			{
				displayName: 'Contact',
				name: 'contact',
				values: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'Phone Number', name: 'phone', type: 'string', default: '', placeholder: '+97235550100' },
				],
			},
		],
	},

	// Send Poll
	{ displayName: 'Question', name: 'question', type: 'string', default: '', required: true, displayOptions: show(['sendPoll']) },
	{
		displayName: 'Poll Options',
		name: 'pollOptions',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Option' },
		default: [],
		description: '2 to 12 options, each different',
		displayOptions: show(['sendPoll']),
	},
	{ displayName: 'Allow Multiple Answers', name: 'multipleAnswers', type: 'boolean', default: false, description: 'Whether people may choose more than one option', displayOptions: show(['sendPoll']) },

	sendOptionsField,

	// Get, Download Media, React, Edit, Delete, Vote
	{ displayName: 'Message ID', name: 'messageId', type: 'string', default: '', required: true, displayOptions: show(['get', 'downloadMedia', 'react', 'edit', 'delete', 'vote']) },
	{ displayName: 'Put Output File in Field', name: 'binaryPropertyName', type: 'string', default: 'data', required: true, displayOptions: show(['downloadMedia']) },
	{ displayName: 'Emoji', name: 'emoji', type: 'string', default: '👍', description: 'One emoji. Leave empty to take your reaction back.', displayOptions: show(['react']) },
	{ displayName: 'New Text', name: 'newText', type: 'string', typeOptions: { rows: 4 }, default: '', required: true, displayOptions: show(['edit']) },
	{
		displayName: 'Options to Choose',
		name: 'voteOptions',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Option' },
		default: [],
		description: "The options' names. None takes your vote back.",
		displayOptions: show(['vote']),
	},

	// Get Many
	chatLocator('filterChatId', 'Chat', { resource: ['message'], operation: ['getMany'] }, { required: false, description: "Only this chat's messages; leave empty for all" }),
	...paging('message'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getMany']),
		options: [
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				default: 'inbound',
				options: [
					{ name: 'Inbound', value: 'inbound' },
					{ name: 'Outbound', value: 'outbound' },
				],
			},
			{
				displayName: 'Received Since',
				name: 'receivedSince',
				type: 'dateTime',
				default: '',
				description: 'Catch up: messages OverSend received from this time on, oldest first (late arrivals included). Not with Since.',
			},
			{ displayName: 'Since', name: 'since', type: 'dateTime', default: '', description: 'Only messages whose own time is from then on, newest first' },
		],
	},
];
