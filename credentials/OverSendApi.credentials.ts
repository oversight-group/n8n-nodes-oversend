import type {
	Icon,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OverSendApi implements ICredentialType {
	name = 'overSendApi';

	icon: Icon = { light: 'file:oversend.svg', dark: 'file:oversend.dark.svg' };

	displayName = 'OverSend API';

	documentationUrl = 'https://api.oversend.co.il/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create one in OverSend under Settings > API. For the OverSend Trigger, give it the "webhooks:manage" scope and the read scopes of the events you need.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.oversend.co.il',
			description: 'Change only to use a staging or local OverSend backend',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "").replace(/\\/v1$/, "")}}',
			url: '/v1/instance',
		},
	};
}
