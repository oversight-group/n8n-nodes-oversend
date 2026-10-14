# Changelog

## 0.1.0

First release.

OverSend node (actions):

- Message: send text, media by URL, a file from the workflow, a template, a location, contact cards and polls; get, get many, download media, react, edit, delete and vote.
- Chat: get, get many, update, set labels, mark read.
- Note: create, get many, update, delete.
- Scheduled Message: get, get many, cancel.
- Contact: check which numbers are on WhatsApp.
- Unsubscribe: add, get many, remove.
- Label, Member and Template: get many.
- Instance: get the WhatsApp connection status.
- Every send can go to a phone number, a chat or a group (chats and groups are picked from a searchable list), and supports Send At, Ignore Unsubscribe and an idempotency key.
- Usable as a tool by n8n AI agents.

OverSend Trigger:

- Registers its own webhook in OverSend and removes it when the workflow is deactivated.
- Events: message received, status, edited, deleted, reaction and poll votes; chat updated; scheduled message status; WhatsApp connection changed; contact unsubscribed and resubscribed.
- Checks the webhook signature and rejects stale or tampered requests.
- Filters for groups or direct chats and for inbound or outbound messages; full event or data only.
