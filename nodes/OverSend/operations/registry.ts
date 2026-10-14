import type { Handler } from '../helpers';
import { chatHandlers } from './chat';
import { contactHandlers } from './contact';
import { messageHandlers } from './message';
import { noteHandlers } from './note';
import { scheduledMessageHandlers } from './scheduledMessage';
import { instanceHandlers, labelHandlers, memberHandlers, templateHandlers } from './simple';
import { unsubscribeHandlers } from './unsubscribe';

export const HANDLERS: Record<string, Record<string, Handler>> = {
	message: messageHandlers,
	chat: chatHandlers,
	note: noteHandlers,
	scheduledMessage: scheduledMessageHandlers,
	contact: contactHandlers,
	unsubscribe: unsubscribeHandlers,
	label: labelHandlers,
	member: memberHandlers,
	template: templateHandlers,
	instance: instanceHandlers,
};

export function getHandler(resource: string, operation: string): Handler {
	const handler = HANDLERS[resource]?.[operation];
	if (!handler) throw new Error(`Unknown operation "${resource}.${operation}"`);
	return handler;
}
