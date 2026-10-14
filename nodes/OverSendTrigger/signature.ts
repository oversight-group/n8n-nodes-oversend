import { createHmac, timingSafeEqual } from 'crypto';

/** How far the signed time may be from now, either way. */
export const TOLERANCE_SECONDS = 300;

/** `x-oversend-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. */
export function verifySignature(secret: string, header: string | undefined, rawBody: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
	if (!header) return false;
	const parts: Record<string, string> = {};
	for (const piece of header.split(',')) {
		const at = piece.indexOf('=');
		if (at > 0) parts[piece.slice(0, at).trim()] = piece.slice(at + 1).trim();
	}
	const t = Number(parts.t);
	if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(parts.v1 ?? '')) return false;
	if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false;
	const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
	return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}
