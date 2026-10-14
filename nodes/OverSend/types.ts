export interface ApiChat {
	id: string;
	type: 'group' | 'direct';
	name: string | null;
	phone: string | null;
}

export interface ApiMetaTemplate {
	type: 'meta';
	name: string;
	language: string;
	category: string;
	needs: {
		header: {
			type: 'none' | 'text' | 'image' | 'video' | 'document';
			params?: number;
			defaultFile?: { fileName: string } | null;
		};
		bodyParams: number;
		buttons: Array<{ index: number; text: string; url: string }>;
		code: boolean;
	};
}

export interface ApiQuickTemplate {
	type: 'quick';
	name: string;
	title: string;
	body: string;
	placeholders: Array<{ name: string; fallback: string | null }>;
	file: { fileName: string; mimeType: string } | null;
}

export type ApiTemplate = ApiMetaTemplate | ApiQuickTemplate;
