import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { properties } from './descriptions';
import { listSearch } from './methods/listSearch';
import { loadOptions } from './methods/loadOptions';
import { resourceMapping } from './methods/resourceMapping';
import { getHandler } from './operations/registry';

/**
 * `NodeConnectionTypes` is missing on older n8n-workflow; reading `.Main` there throws while the
 * class is built, which n8n reports as "Class could not be found". Both resolve to 'main'.
 */
const MAIN_CONNECTION: NodeConnectionType = NodeConnectionTypes?.Main ?? 'main';

export class OverSend implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OverSend',
		name: 'overSend',
		icon: { light: 'file:oversend.svg', dark: 'file:oversend.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send WhatsApp messages to people and groups, and manage chats in OverSend',
		defaults: { name: 'OverSend' },
		usableAsTool: true,
		inputs: [MAIN_CONNECTION],
		outputs: [MAIN_CONNECTION],
		credentials: [{ name: 'overSendApi', required: true }],
		properties,
	};

	methods = { loadOptions, listSearch, resourceMapping };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i += 1) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				out.push(...(await getHandler(resource, operation)(this, i)));
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
