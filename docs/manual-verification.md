# Manual verification record

**Date:** 2026-10-15
**Package version:** 0.1.0
**n8n version:** 2.35.5

## Setup

n8n 2.35.5 (official Docker image `docker.n8n.io/n8nio/n8n:latest`), package 0.1.0 loaded from the packed tarball as a custom extension (`N8N_CUSTOM_EXTENSIONS`). The OverSend backend ran from branch `feat/n8n-webhooks` on a local dev database with a seeded company (a WhatsApp Web instance, a group chat, a direct chat, the label VIP, and the quick template "welcome"). Evolution was deliberately unreachable, so sends end with status "failed" after OverSend accepted them. The front ran from branch `feat/n8n-webhooks` against that backend.

## Automated gates

Run on the same build as the live check.

| Gate | Result |
|---|---|
| Package unit tests (`npm test`) | 108/108 pass |
| Package lint (`npm run lint`) | clean |
| n8n verification scan (`npm run scan`), source and dist | "n8n would ACCEPT" for both |
| Backend suite, unit and integration | 750/750 pass |
| Front typecheck, lint and tests | pass |

## Results in n8n

| # | Check | Result |
|---|---|---|
| 1 | n8n loads OverSend, OverSend Trigger and the AI tool variant (OverSend Tool) | PASS |
| 2 | Credential test: correct key with base URL ending in /v1 gives "Connection successful"; wrong key gives "Unauthorized" | PASS |
| 3 | Group picker (searchGroups) lists "n8n Test Group (group)"; chat search "  Dana " finds "Dana Test (+972501234567)" | PASS |
| 4 | Templates, Labels and Assignee (with "Unassigned") dropdowns load; template field mapping shows {first_name} for the quick template | PASS |
| 5 | Send Text to a Group sends chatId of the group (message created, isGroup true) | PASS |
| 6 | Chat Update (status pending, unassign, pin) and Set Labels (VIP) | PASS |
| 7 | Send Template (quick "welcome", first_name Dana) renders "Hi Dana" | PASS |
| 8 | Send At "2026-12-15T10:00:00" in a workflow set to Asia/Jerusalem schedules 2026-12-15T08:00:00.000Z | PASS |
| 9 | Send File from binary (invoice.txt) arrives as a document with its name, type and caption | PASS |
| 10 | Unknown chat id with Continue On Fail outputs { error: "OverSend: not_found" } | PASS |
| 11 | Chat Get Many with type group returns only the group | PASS |
| 12 | Activating the trigger workflow registers a webhook in OverSend (GET /v1/webhooks) | PASS |
| 13 | chat.updated on the direct chat starts one execution with the full event; the group's update is delivered (200) and ignored by the "direct only" filter | PASS |
| 14 | A forged signature is answered 401 | PASS |
| 15 | "Execute workflow" (test listening) while the workflow is active adds a /webhook-test/ webhook beside the production one; the test event arrives in the editor; afterwards only the production webhook remains | PASS |
| 16 | Deactivating removes the webhook; reactivating creates a fresh one | PASS |
| 17 | OverSend Settings > API: the n8n webhook shows "Created by the API key ..." with no Edit/Rotate; "Add endpoint" stays enabled; the new-key dialog lists webhooks:manage (Hebrew label) | PASS |

Not covered live: real WhatsApp delivery (Evolution offline on purpose), Cloud API templates, poll/vote/edit/delete against a live WhatsApp Web session, message.* trigger events from real inbound messages.
