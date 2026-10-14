import { OverSendApi } from '../credentials/OverSendApi.credentials';

describe('OverSendApi credential', () => {
	const credential = new OverSendApi();

	it('is named as the nodes reference it', () => {
		expect(credential.name).toBe('overSendApi');
		expect(credential.displayName).toBe('OverSend API');
	});

	it('takes a secret API key and a base URL that defaults to production', () => {
		const apiKey = credential.properties.find((p) => p.name === 'apiKey');
		const baseUrl = credential.properties.find((p) => p.name === 'baseUrl');
		expect(apiKey?.typeOptions?.password).toBe(true);
		expect(apiKey?.required).toBe(true);
		expect(baseUrl?.default).toBe('https://api.oversend.co.il');
	});

	it('sends the key as a bearer token', () => {
		expect(credential.authenticate).toEqual({
			type: 'generic',
			properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
		});
	});

	it('tests the key against GET /v1/instance', () => {
		expect(credential.test.request.url).toBe('/v1/instance');
		expect(credential.test.request.baseURL).toBe(
			String.raw`={{$credentials.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}}`,
		);
	});

	it('has distinct light and dark icons', () => {
		expect(credential.icon).toEqual({ light: 'file:oversend.svg', dark: 'file:oversend.dark.svg' });
	});
});
