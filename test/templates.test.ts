import { decodeTemplate, encodeTemplate, findTemplate, templateBody, templateFields } from '../nodes/OverSend/templates';
import type { ApiMetaTemplate, ApiQuickTemplate } from '../nodes/OverSend/types';

const sale: ApiMetaTemplate = {
	type: 'meta',
	name: 'autumn_sale',
	language: 'he',
	category: 'MARKETING',
	needs: {
		header: { type: 'image', defaultFile: null },
		bodyParams: 2,
		buttons: [{ index: 1, text: 'Shop', url: 'https://x.test/{{1}}' }],
		code: false,
	},
};
const login: ApiMetaTemplate = {
	type: 'meta',
	name: 'login_code',
	language: 'en_US',
	category: 'AUTHENTICATION',
	needs: { header: { type: 'text', params: 1 }, bodyParams: 0, buttons: [], code: true },
};
const welcome: ApiQuickTemplate = {
	type: 'quick',
	name: 'welcome',
	title: 'Welcome',
	body: 'Hi {first_name}',
	placeholders: [{ name: 'first_name', fallback: 'friend' }, { name: 'agent', fallback: null }],
	file: null,
};

describe('template values', () => {
	it('round-trip and keep the type', () => {
		expect(encodeTemplate(sale)).toBe('meta|he|autumn_sale');
		expect(encodeTemplate(welcome)).toBe('quick||welcome');
		expect(decodeTemplate('meta|he|autumn_sale')).toEqual({ type: 'meta', language: 'he', name: 'autumn_sale' });
		expect(decodeTemplate('quick||a|b')).toEqual({ type: 'quick', language: '', name: 'a|b' });
		expect(() => decodeTemplate('autumn_sale')).toThrow('choose it again');
	});

	it('finds the template a value names', () => {
		expect(findTemplate([sale, login, welcome], 'meta|en_US|login_code')).toBe(login);
		expect(findTemplate([sale], 'meta|en|autumn_sale')).toBeUndefined();
		expect(findTemplate([welcome], 'quick||welcome')).toBe(welcome);
	});
});

describe('templateFields', () => {
	it('lists what a Meta template needs', () => {
		expect(templateFields(sale).map((f) => [f.id, f.displayName, f.required])).toEqual([
			['body_1', 'Body {{1}}', true],
			['body_2', 'Body {{2}}', true],
			['headerFileUrl', 'Header Image URL', true],
			['button_1', 'Button "Shop" Value', true],
		]);
		expect(templateFields(login).map((f) => f.id)).toEqual(['header', 'code']);
	});

	it('makes the header file optional when the template has a default one, and asks a name for documents', () => {
		const doc = { ...sale, needs: { ...sale.needs, header: { type: 'document' as const, defaultFile: { fileName: 'menu.pdf' } } } };
		expect(templateFields(doc).filter((f) => f.id.startsWith('header')).map((f) => [f.id, f.required])).toEqual([
			['headerFileUrl', false],
			['headerFileName', false],
		]);
	});

	it('lists a quick template placeholder per field, with its fallback', () => {
		expect(templateFields(welcome).map((f) => [f.id, f.displayName, f.required])).toEqual([
			['value_first_name', '{first_name} (if empty: friend)', false],
			['value_agent', '{agent}', false],
		]);
	});
});

describe('templateBody', () => {
	it('builds Meta params in order', () => {
		expect(
			templateBody('meta|he|autumn_sale', { body_2: 'B', body_1: 'A', button_1: 'X9', headerFileUrl: 'https://x.test/a.jpg', headerFileName: '' }),
		).toEqual({
			name: 'autumn_sale',
			language: 'he',
			params: { body: ['A', 'B'], buttons: ['X9'], headerMedia: { url: 'https://x.test/a.jpg' } },
		});
		expect(templateBody('meta|en_US|login_code', { header: 'Hi', code: 482913 })).toEqual({
			name: 'login_code',
			language: 'en_US',
			params: { header: ['Hi'], code: '482913' },
		});
		expect(templateBody('meta|he|plain', {})).toEqual({ name: 'plain', language: 'he' });
	});

	it('orders body values numerically past nine', () => {
		const mapped = Object.fromEntries(Array.from({ length: 11 }, (_, n) => [`body_${n + 1}`, String(n + 1)]));
		expect((templateBody('meta|he|t', mapped).params as { body: string[] }).body).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
	});

	it('sends quick template values by name, leaving out empty ones', () => {
		expect(templateBody('quick||welcome', { value_first_name: 'Dana', value_agent: '' })).toEqual({
			name: 'welcome',
			params: { values: { first_name: 'Dana' } },
		});
		expect(templateBody('quick||welcome', {})).toEqual({ name: 'welcome' });
	});
});
