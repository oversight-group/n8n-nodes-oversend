import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';
import { findTemplate, templateFields } from '../templates';
import { apiRequest } from '../transport/request';
import type { ApiTemplate } from '../types';

export const resourceMapping = {
	async getTemplateFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
		const value = this.getNodeParameter('template', '') as string;
		if (!value) return { fields: [] };
		const { templates } = await apiRequest<{ templates: ApiTemplate[] }>(this, 'GET', '/templates');
		const found = findTemplate(templates, value);
		return { fields: found ? templateFields(found) : [] };
	},
};
