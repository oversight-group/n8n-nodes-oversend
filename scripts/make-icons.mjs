/**
 * Writes the node and credential icons from the brand kit's PNG symbol.
 * Run with: npm run icons [path-to-kit-PNG-folder]
 * The SVG embeds the PNG (about 3 KB) because the kit's vector files are 200-300 KB traced paths.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const kit = process.argv[2] ?? 'C:/Users/rotem/Nextcloud/Projects (Internal)/OverSend/OverSend Media Kit/02_PNG_Transparent/Icon';
const root = resolve(import.meta.dirname, '..');
const svg = (png) =>
	`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="60" height="60" viewBox="0 0 192 192"><image width="192" height="192" xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>\n`;

const light = svg(readFileSync(`${kit}/Color/oversend-icon-color-w0192.png`));
const dark = svg(readFileSync(`${kit}/White/oversend-icon-white-w0192.png`));
for (const dir of ['credentials', 'nodes/OverSend', 'nodes/OverSendTrigger']) {
	writeFileSync(resolve(root, dir, 'oversend.svg'), light);
	writeFileSync(resolve(root, dir, 'oversend.dark.svg'), dark);
}
console.log('Icons written.');
