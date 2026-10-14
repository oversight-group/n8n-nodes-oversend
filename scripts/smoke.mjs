/**
 * Live read-only check of the OverSend API contract the node relies on. Sends no WhatsApp messages.
 * Run with: npm run smoke   (reads OVERSEND_BASE_URL and OVERSEND_API_KEY from .env)
 * Plain ESM, not TypeScript, so the verification scanner doesn't treat it as shipped node code.
 */
const BASE = (process.env.OVERSEND_BASE_URL ?? 'https://api.oversend.co.il').replace(/\/+$/, '');
const KEY = process.env.OVERSEND_API_KEY;

const CHECKS = [
	['/v1/instance', (b) => typeof b.status === 'string'],
	['/v1/chats?limit=5', (b) => Array.isArray(b.chats) && 'nextCursor' in b],
	['/v1/chats?type=group&limit=5', (b) => Array.isArray(b.chats) && b.chats.every((c) => c.type === 'group')],
	['/v1/labels', (b) => Array.isArray(b.labels)],
	['/v1/members', (b) => Array.isArray(b.members)],
	['/v1/templates', (b) => Array.isArray(b.templates)],
	['/v1/messages?limit=5', (b) => Array.isArray(b.messages)],
	['/v1/scheduled-messages?limit=5', (b) => Array.isArray(b.scheduled)],
	['/v1/unsubscribes?limit=5', (b) => Array.isArray(b.unsubscribes)],
	['/v1/webhooks', (b) => Array.isArray(b.webhooks) && Array.isArray(b.events)],
];

if (!KEY) {
	console.error('Set OVERSEND_API_KEY in .env');
	process.exit(1);
}
let failed = 0;
for (const [path, ok] of CHECKS) {
	const res = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${KEY}` } });
	const body = await res.json().catch(() => ({}));
	const pass = res.ok && ok(body);
	if (!pass) failed += 1;
	console.log(`${pass ? 'PASS' : 'FAIL'} ${res.status} GET ${path}${pass ? '' : ` ${JSON.stringify(body).slice(0, 200)}`}`);
}
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
