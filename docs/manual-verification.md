# Manual verification record

Fill this in after testing the built package in a real n8n against a real OverSend company. Nothing below has been run yet.

**Date:**
**Package version:** 0.1.0
**n8n version:**
**OverSend environment:**
**How the package was installed:** (for example `npm pack`, then `npm install ./n8n-nodes-oversend-0.1.0.tgz` inside `~/.n8n/nodes`. Installing from a folder path creates a symlink that does not resolve inside a Docker container, so n8n loads nothing.)

## Automated gates

| Gate | Command | Result |
|---|---|---|
| Unit tests (no network) | `npm test` | |
| TypeScript | `npx tsc --noEmit` | |
| n8n community lint ruleset | `npm run lint` | |
| Build | `npm run build` | |
| n8n verification scan, both legs | `npm run scan` | |
| Live API contract (read-only) | `npm run smoke` | |

## Checks in n8n

| # | Check | Result |
|---|---|---|
| 1 | n8n log shows both nodes and the credential loaded | |
| 2 | Credential Test succeeds (calls `GET /v1/instance`) | |
| 3 | A wrong key fails the credential test with a clear message | |
| 4 | Send To > Chat lists chats by name and searches while typing | |
| 5 | Send To > Group lists only groups; sending a text to one works | |
| 6 | Send To > Phone Number sends a text | |
| 7 | Send Template: pick a Meta template, its fields appear, the message is delivered with the values filled in | |
| 8 | Send Template: pick a quick (WhatsApp Web) template, its fields appear | |
| 9 | Send File sends a binary from an earlier node; Download Media returns a binary | |
| 10 | Send At with a date and no offset: the scheduled time matches the workflow time zone | |
| 11 | Retry On Fail does not send twice; a loop over several items sends every message | |
| 12 | Get Many with Return All follows pages | |
| 13 | Trigger: activate the workflow, a webhook appears in OverSend Settings marked "Created by the API key ..." | |
| 14 | Trigger: a message to the connected number starts the workflow with the expected output | |
| 15 | Trigger: Listen for test event and the production URL both work and coexist | |
| 16 | Trigger: deactivate the workflow, the webhook is removed | |
| 17 | The node can be used as a tool by an AI agent | |

## Notes
