export interface MultipartFile {
	field: string;
	fileName: string;
	mimeType: string;
	data: Buffer;
}

/** Header-safe: no quotes or line breaks inside a quoted header value. */
const quoted = (value: string) => value.replace(/"/g, '%22').replace(/[\r\n]/g, ' ');

/**
 * A multipart/form-data body built by hand: no runtime dependency, and the same
 * bytes on every n8n version (n8n's own FormData handling has changed between releases).
 * File names are written as UTF-8, which OverSend reads back as UTF-8.
 */
export function buildMultipart(
	fields: Record<string, string>,
	file: MultipartFile,
	boundary = `OverSendN8n${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`,
): { body: Buffer; contentType: string } {
	const parts: Buffer[] = [];
	for (const [name, value] of Object.entries(fields)) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${quoted(name)}"\r\n\r\n${value}\r\n`, 'utf8'));
	}
	parts.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${quoted(file.field)}"; filename="${quoted(file.fileName)}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
			'utf8',
		),
		file.data,
		Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
	);
	return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}
