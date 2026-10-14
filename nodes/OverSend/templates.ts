import type { IDataObject, ResourceMapperField } from 'n8n-workflow';
import type { ApiTemplate } from './types';

export interface TemplateRef {
	type: 'meta' | 'quick';
	language: string;
	name: string;
}

/** `meta|<language>|<name>` or `quick||<name>`: the type is known without a request, and it survives reloads. */
export function encodeTemplate(t: ApiTemplate): string {
	return t.type === 'meta' ? `meta|${t.language}|${t.name}` : `quick||${t.name}`;
}

export function decodeTemplate(value: string): TemplateRef {
	const [type, language = '', ...rest] = value.split('|');
	if ((type !== 'meta' && type !== 'quick') || rest.length === 0 || rest.join('|') === '') {
		throw new Error(`Unknown template "${value}": choose it again from the list`);
	}
	return { type, language, name: rest.join('|') };
}

export function findTemplate(list: ApiTemplate[], value: string): ApiTemplate | undefined {
	const ref = decodeTemplate(value);
	return list.find((t) => t.type === ref.type && t.name === ref.name && (t.type === 'quick' || t.language === ref.language));
}

const field = (id: string, displayName: string, required: boolean): ResourceMapperField => ({
	id,
	displayName,
	required,
	defaultMatch: false,
	canBeUsedToMatch: false,
	display: true,
	type: 'string',
});

const HEADER_FILE: Record<string, string> = { image: 'Image', video: 'Video', document: 'Document' };

export function templateFields(t: ApiTemplate): ResourceMapperField[] {
	if (t.type === 'quick') {
		return t.placeholders.map((p) =>
			field(`value_${p.name}`, p.fallback ? `{${p.name}} (if empty: ${p.fallback})` : `{${p.name}}`, false),
		);
	}
	const { header, bodyParams, buttons, code } = t.needs;
	const fields: ResourceMapperField[] = [];
	if (header.type === 'text' && (header.params ?? 0) > 0) fields.push(field('header', 'Header {{1}}', true));
	for (let n = 1; n <= bodyParams; n += 1) fields.push(field(`body_${n}`, `Body {{${n}}}`, true));
	if (HEADER_FILE[header.type]) {
		const required = !header.defaultFile;
		fields.push(field('headerFileUrl', `Header ${HEADER_FILE[header.type]} URL`, required));
		if (header.type === 'document') fields.push(field('headerFileName', 'Header Document File Name', false));
	}
	for (const button of buttons) fields.push(field(`button_${button.index}`, `Button "${button.text}" Value`, true));
	if (code) fields.push(field('code', 'Code', true));
	return fields;
}

const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

/** Values of `prefix_<n>` keys, ordered by n. */
function numbered(mapped: Record<string, unknown>, prefix: string): string[] {
	return Object.keys(mapped)
		.filter((key) => key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length)))
		.sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)))
		.map((key) => text(mapped[key]));
}

/** The `template` object of a send, from the chosen template and the mapped field values. */
export function templateBody(value: string, mapped: Record<string, unknown>): IDataObject {
	const ref = decodeTemplate(value);
	if (ref.type === 'quick') {
		const values: IDataObject = {};
		for (const [key, raw] of Object.entries(mapped)) {
			if (key.startsWith('value_') && text(raw) !== '') values[key.slice('value_'.length)] = text(raw);
		}
		return Object.keys(values).length > 0 ? { name: ref.name, params: { values } } : { name: ref.name };
	}
	const params: IDataObject = {};
	if (text(mapped.header) !== '') params.header = [text(mapped.header)];
	const body = numbered(mapped, 'body_');
	if (body.length > 0) params.body = body;
	const buttons = numbered(mapped, 'button_');
	if (buttons.length > 0) params.buttons = buttons;
	if (text(mapped.headerFileUrl) !== '') {
		params.headerMedia = {
			url: text(mapped.headerFileUrl),
			...(text(mapped.headerFileName) !== '' && { filename: text(mapped.headerFileName) }),
		};
	}
	if (text(mapped.code) !== '') params.code = text(mapped.code);
	return Object.keys(params).length > 0
		? { name: ref.name, language: ref.language, params }
		: { name: ref.name, language: ref.language };
}
