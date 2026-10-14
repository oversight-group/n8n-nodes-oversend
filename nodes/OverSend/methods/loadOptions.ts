import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { encodeTemplate } from '../templates';
import { apiRequest } from '../transport/request';
import type { ApiTemplate } from '../types';

interface ApiMember {
	id: string;
	name: string;
	email: string;
}

async function members(ctx: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { members } = await apiRequest<{ members: ApiMember[] }>(ctx, 'GET', '/members');
	return members.map((m) => ({ name: m.name, value: m.id, description: m.email }));
}

export const loadOptions = {
	async getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const { labels } = await apiRequest<{ labels: Array<{ id: string; name: string }> }>(this, 'GET', '/labels');
		return labels.map((l) => ({ name: l.name, value: l.id }));
	},

	async getMembers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return members(this);
	},

	/** For filters and assignment: "none" means unassigned. */
	async getMembersOrNone(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return [{ name: 'Unassigned', value: 'none' }, ...(await members(this))];
	},

	async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const { templates } = await apiRequest<{ templates: ApiTemplate[] }>(this, 'GET', '/templates');
		return templates.map((t) =>
			t.type === 'meta'
				? { name: `${t.name} (${t.language})`, value: encodeTemplate(t), description: t.category }
				: { name: t.title, value: encodeTemplate(t), description: t.name },
		);
	},
};
