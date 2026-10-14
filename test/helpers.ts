import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

export interface Call {
	method: string;
	url: string;
	qs?: IDataObject;
	body?: unknown;
	headers?: IDataObject;
	json?: boolean;
	encoding?: string;
	returnFullResponse?: boolean;
}

export type Reply = (call: Call) => unknown;

/** A resource locator value as n8n stores it. */
export const rl = (value: string) => ({ __rl: true, mode: 'list', value });

/**
 * As strict as n8n: a parameter with no value throws unless a non-undefined
 * fallback is given (n8n treats an undefined fallback as no fallback).
 */
export function parameterReader(params: Record<string, unknown>) {
	return (name: string, _i?: unknown, fallback?: unknown, options?: { extractValue?: boolean }) => {
		const value = params[name];
		if (value === undefined) {
			if (fallback !== undefined) return fallback;
			throw new Error(`Could not get parameter "${name}"`);
		}
		if (options?.extractValue && typeof value === 'object' && value !== null && '__rl' in value) {
			return (value as unknown as { value: unknown }).value;
		}
		return value;
	};
}

const NODE = { id: 'node-1', name: 'OverSend', type: 'n8n-nodes-oversend.overSend', typeVersion: 1, position: [0, 0], parameters: {} };

export interface ExecuteExtra {
	executionId?: string;
	continueOnFail?: boolean;
	timezone?: string;
	runIndex?: number;
	binary?: Record<string, { meta: { fileName?: string; mimeType: string }; data: Buffer }>;
	items?: number;
}

export function fakeExecute(params: Record<string, unknown>, reply: Reply = () => ({}), extra: ExecuteExtra = {}) {
	const calls: Call[] = [];
	const ctx = {
		getNodeParameter: parameterReader(params),
		getCredentials: async () => ({ apiKey: 'osk_live_test', baseUrl: 'https://api.example.test/' }),
		getNode: () => NODE,
		getExecutionId: () => extra.executionId ?? 'exec-1',
		getTimezone: () => extra.timezone ?? 'UTC',
		getWorkflowDataProxy: () => ({ $runIndex: extra.runIndex ?? 0 }),
		getInputData: () => Array.from({ length: extra.items ?? 1 }, () => ({ json: {} })),
		continueOnFail: () => extra.continueOnFail ?? false,
		helpers: {
			httpRequestWithAuthentication: async (_credential: string, options: Call) => {
				calls.push(options);
				return reply(options);
			},
			assertBinaryData: (_i: number, name: string) => {
				const found = extra.binary?.[name];
				if (!found) throw new Error(`This operation expects the node's input data to contain a binary file '${name}'`);
				return found.meta;
			},
			getBinaryDataBuffer: async (_i: number, name: string) => extra.binary![name].data,
			prepareBinaryData: async (data: Buffer, fileName?: string, mimeType?: string) => ({
				data: data.toString('base64'),
				fileName,
				mimeType,
			}),
		},
	} as unknown as IExecuteFunctions;
	return { ctx, calls };
}

export function fakeLoadOptions(params: Record<string, unknown>, reply: Reply = () => ({})) {
	const calls: Call[] = [];
	const read = parameterReader(params);
	const ctx = {
		getNodeParameter: (name: string, fallback?: unknown) => read(name, 0, fallback),
		getCredentials: async () => ({ apiKey: 'osk_live_test', baseUrl: 'https://api.example.test' }),
		getNode: () => NODE,
		helpers: {
			httpRequestWithAuthentication: async (_credential: string, options: Call) => {
				calls.push(options);
				return reply(options);
			},
		},
	} as unknown as ILoadOptionsFunctions;
	return { ctx, calls };
}

/** An error shaped as n8n's request helper throws it for an HTTP error answer. */
export function httpError(status: number, body: unknown, headers: Record<string, string> = {}, shape: 'body' | 'data' | 'cause' = 'body') {
	const response = shape === 'data' ? { status, data: body, headers } : { statusCode: status, body, headers };
	const error = new Error(`Request failed with status code ${status}`) as Error & Record<string, unknown>;
	if (shape === 'cause') error.cause = { response };
	else error.response = response;
	return error;
}
