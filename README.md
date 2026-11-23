# n8n-nodes-oversend

An [n8n](https://n8n.io) community node for [OverSend](https://oversend.co.il): send WhatsApp messages to people and groups, send approved templates, manage chats, notes, labels and scheduled messages, handle unsubscribes, and start workflows when a message arrives. The API reference is at [api.oversend.co.il/docs](https://api.oversend.co.il/docs).

The package has two nodes:

- **OverSend** - actions: send messages and manage chats, notes, scheduled messages, unsubscribes and more.
- **OverSend Trigger** - starts a workflow on a WhatsApp event. It registers its own webhook, so there is nothing to set up by hand.

The OverSend node can also be used as a tool by n8n AI agents.

## Installation

In n8n, go to **Settings > Community Nodes > Install** and enter:

```
n8n-nodes-oversend
```

For a self-hosted n8n you can also install it by hand:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-oversend
```

Then restart n8n.

## Credentials

Create an API key in OverSend under **Settings > API**, then add an **OverSend API** credential in n8n:

| Field | Value |
|---|---|
| API Key | The key you created in OverSend |
| Base URL | Leave as it is. Change it only to test against a staging or local OverSend |

Click **Test** on the credential. It calls `GET /v1/instance`, so it also shows that the key works.

A key can have all scopes or only some. Give it the scopes of the operations you use:

| Scope | Needed for |
|---|---|
| `messages:send` | Every Send operation, and Message React, Edit, Delete and Vote, and Scheduled Message Cancel |
| `messages:read` | Message Get, Get Many and Download Media, Scheduled Message Get and Get Many |
| `chats:read` | Chat Get and Get Many, Note Get Many, Label and Member Get Many, Unsubscribe Get Many, the chat and group pickers |
| `chats:write` | Chat Update, Set Labels and Mark Read, Note Create, Update and Delete, Unsubscribe Add and Remove |
| `contacts:check` | Contact > Check WhatsApp |
| `webhooks:manage` | OverSend Trigger |

Template Get Many, Instance Get Status and the credential test need no scope.

The trigger needs `webhooks:manage` plus the read scope of the events you pick: `messages:read` for message events (and scheduled message status), `chats:read` for chat updated and contact unsubscribed or resubscribed events. WhatsApp connection events need nothing more.

If a call fails with `insufficient_scope`, the error names the missing scope. Scopes can't be changed on an existing key, so create a new key.

Editing or deleting a message, and editing or deleting a note, work only for items this API key created; for others the API answers `forbidden`. Scheduled Message Cancel likewise works only for messages this key scheduled.

## Operations

| Resource | Operations |
|---|---|
| Message | Send Text (with Reply To and Mentions), Send Media by URL (image, video, audio, document), Send File (from a binary property of the workflow), Send Template, Send Location, Send Contact Cards (1 to 10), Send Poll (2 to 12 options), Get, Get Many (filter by chat, direction and time), Download Media (to a binary property), React (an empty emoji removes the reaction), Edit, Delete, Vote |
| Chat | Get, Get Many (filter by type, search, status, assignee and label), Update (status, assignee, archived, pinned, snooze, mark unread), Set Labels (an empty list clears them), Mark Read |
| Note | Create, Get Many, Update, Delete |
| Scheduled Message | Get, Get Many (filter by chat and status), Cancel |
| Contact | Check WhatsApp (more than 20 numbers are sent in batches) |
| Unsubscribe | Add, Get Many, Remove |
| Label | Get Many |
| Member | Get Many |
| Template | Get Many |
| Instance | Get Status |

Get Many operations return one item per entry. **Return All** follows the API's pages; otherwise **Limit** applies. Note Delete and Unsubscribe Remove return `{ "success": true }`. Message Delete returns the message (or `{ "id": ..., "deleted": true }`).

Contact > Check WhatsApp works only for WhatsApp Web numbers. Polls, votes, edits and deletes also work only for WhatsApp Web numbers. On a WhatsApp Cloud API number the API answers `not_supported`, and the node shows a plain message saying so.

Errors show OverSend's error code and, for the common ones, a hint (for example `contact_unsubscribed`: use Ignore Unsubscribe; `window_closed`: send a template). With **Continue On Fail** the item returns `{ "error": ... }` and the workflow goes on.

## Sending to a group

Every send has a **Send To** field with three choices:

- **Phone Number** - any phone format the API accepts.
- **Chat** - pick one of the company's chats from the list, or enter its ID.
- **Group** - the same list, limited to groups.

The Chat and Group pickers search the company's chats as you type. Groups are labelled "(group)" in the list. To send to a group, choose **Send To > Group** and pick it, or switch the picker to **By ID** and enter the chat ID. You can get group IDs from `GET /v1/chats?type=group`, from Chat > Get Many with Type set to Group, or from the `chatId` field of an OverSend Trigger event. The same chat picker is used wherever an operation takes a chat (Chat, Note, and the chat filters of Message and Scheduled Message).

## Templates

Choose **Message > Send Template** and pick a template from the list. Meta templates are shown as "name (language)", WhatsApp Web quick templates by their title. The fields the template needs then appear in the node:

- **Meta templates:** one field per header value, per body value (`{{1}}`, `{{2}}`...) and per URL button value. If the header is a file, a Header File URL (and file name) field appears; it is optional when the template has a default file. Authentication templates have a Code field. The template's language is taken from the template you picked.
- **Quick templates (WhatsApp Web):** one field per placeholder; its fallback value is shown in the hint.

In an expression (or when an AI agent calls the node), the Template value is `meta|<language>|<name>` for a Meta template, for example `meta|he|order_update`, and `quick||<name>` for a WhatsApp Web quick template.

Meta templates are the way to write to someone outside the 24-hour window, and they work on Cloud API numbers. Quick templates are for WhatsApp Web numbers.

## Scheduling and retries

Every send has these options:

- **Send At** - a date and time. The message is scheduled, and the node returns the scheduled message. A Send At without an offset (the date picker's `2026-10-15T10:00:00`) is read in the workflow's time zone, which you set in the workflow settings.
- **Ignore Unsubscribe** - send even if the contact has unsubscribed.
- **Idempotency Key** - a key you choose. If you leave it empty, the node builds one from the execution, the node run and the item, so each item of each execution has its own key.

The default key also includes the n8n instance and the workflow, so two n8n instances (staging and production) or a reset n8n never reuse each other's keys. Because of that default key, a loop sends every message, while **Retry On Fail** within one run never sends the same message twice. n8n's "Retry execution" creates a new execution, so it sends the message again. If n8n gives the node no execution ID, no key is sent.

## OverSend Trigger

Add **OverSend Trigger**, choose the events and activate the workflow. The trigger creates a webhook in OverSend that points at the workflow, and removes it when the workflow is deactivated.

**Events:** message received, message status (sent, delivered, read, failed), message edited, message deleted, message reaction, poll votes changed, chat updated, scheduled message status, WhatsApp connection changed, contact unsubscribed, contact resubscribed.

**Options:**

- **Chat Type** - all chats, direct chats only or groups only (message events and chat updated).
- **Direction** - all, inbound (from customers) or outbound (from the company) (message events).
- **Output** - **Full Event** (`id`, `type`, `createdAt`, `companyId` and `data`) or **Data Only** (the message, chat or contact itself).

The trigger checks the webhook signature (HMAC-SHA256 with the webhook's secret, and a time within 5 minutes). A request that fails the check gets a 401 and starts nothing. Test deliveries from OverSend Settings are answered and ignored.

Things to know:

- n8n must be reachable from the internet over public https in production. OverSend does not deliver to other addresses.
- The trigger keeps one webhook per n8n URL, so the test URL ("Listen for test event") and the production URL work side by side.
- The webhooks appear in OverSend Settings, marked "Created by the API key ...". You can disable or delete them there; activating the workflow in n8n again creates a new one. Their URL, events and secret can't be edited there.
- Revoking or deleting the API key deletes its webhooks. If the key expires, its webhooks stay but receive nothing.
- Switching an active trigger's credential to a different API key leaves the old key's webhook posting to the same URL: deliveries get a 401 until OverSend switches it off, or you delete it in Settings. Deactivate the workflow before changing the key.
- A company can have up to 25 webhooks made through the API. They don't count against the 3 you can make in Settings.

## Compatibility

- Node.js 20.15 or later.
- Tested with n8n 2.35.5.

## Development

```bash
npm install --ignore-scripts
npm run build
npm test
npm run lint
```

`--ignore-scripts` skips the native build of a dependency of `n8n-workflow` that this package never runs; only its types are needed.

`npm test` never uses the network. `npm run smoke` runs a read-only check of the OverSend API against a real company: copy `.env.example` to `.env`, fill in a key, and run it. It sends no WhatsApp messages. `npm run scan` runs n8n's community-node verification checks on the source and on the built output (it installs the scanner into `.scan-tool/` on the first run). `docs/PUBLISHING.md` describes how to release the package, and `docs/manual-verification.md` is the record of the manual test in n8n.

## License

[MIT](LICENSE)
