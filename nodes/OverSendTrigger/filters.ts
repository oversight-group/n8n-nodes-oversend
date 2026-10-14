export const WEBHOOK_EVENTS = [
	'message.received',
	'message.status',
	'message.edited',
	'message.deleted',
	'message.reaction',
	'message.poll_votes',
	'chat.updated',
	'scheduled_message.status',
	'instance.status',
	'contact.unsubscribed',
	'contact.resubscribed',
] as const;

export interface OverSendEvent {
	id: string;
	type: string;
	createdAt: string;
	companyId: string;
	data: Record<string, unknown>;
}

export interface TriggerOptions {
	chatType?: 'all' | 'group' | 'direct';
	direction?: 'all' | 'inbound' | 'outbound';
	output?: 'full' | 'data';
}

interface MessageLike {
	isGroup?: boolean;
	direction?: string;
}

function messageOf(event: OverSendEvent): MessageLike | undefined {
	if (!event.type.startsWith('message.')) return undefined;
	return (event.type === 'message.reaction' ? event.data.message : event.data) as MessageLike | undefined;
}

/** Whether the event is one the trigger listens to and passes its chat type and direction filters. */
export function passes(event: OverSendEvent, events: string[], options: TriggerOptions): boolean {
	if (!events.includes(event.type)) return false;
	const chatType = options.chatType ?? 'all';
	const direction = options.direction ?? 'all';
	const message = messageOf(event);
	if (message) {
		if (chatType !== 'all' && message.isGroup !== (chatType === 'group')) return false;
		if (direction !== 'all' && message.direction !== direction) return false;
		return true;
	}
	if (event.type === 'chat.updated' && chatType !== 'all') {
		return (event.data.chat as { type?: string } | undefined)?.type === chatType;
	}
	return true;
}
