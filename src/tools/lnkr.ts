import { deflate } from "pako";

const kinds = { text: 0, markdown: 1, javascript: 2, html: 3 } as const;
export type LnkrKind = keyof typeof kinds;

const extensions: Record<string, LnkrKind> = {
	txt: "text", md: "markdown", markdown: "markdown",
	html: "html", htm: "html", js: "javascript", mjs: "javascript", cjs: "javascript"
};
const mimes: Record<string, LnkrKind> = {
	"text/plain": "text", "text/markdown": "markdown", "text/x-markdown": "markdown",
	"text/html": "html", "text/javascript": "javascript", "application/javascript": "javascript"
};

/** Only offer the handoff for the four text document types, never media/PDF. */
export function lnkrEditKind(file: { name: string; mime: string }): LnkrKind | null {
	const mime = file.mime.split(";", 1)[0].trim().toLowerCase();
	if (/^(?:image|video|audio)\//.test(mime) || mime === "application/pdf") return null;
	const extension = /\.([^.]+)$/.exec(file.name)?.[1].toLowerCase();
	// A named format takes precedence over a generic text/plain MIME (e.g. CSV).
	return extension
		? Object.hasOwn(extensions, extension) ? extensions[extension] : null
		: Object.hasOwn(mimes, mime) ? mimes[mime] : null;
}

// ln.kr v4 wire format: LN magic, version, kind, UTF-8 length, CRC32,
// compressed length, reversed zlib bytes and a high sentinel bit. No dictionaries.
const alphabet = "!#$&'()*+,-./0123456789:;=?~@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]_abcdefghijklmnopqrstuvwxyz";

function gammaBits(value: number): string {
	const binary = value.toString(2);
	return "0".repeat(binary.length - 1) + binary;
}

function fixedBits(value: number, width: number): string {
	return value.toString(2).padStart(width, "0").split("").reverse().join("");
}

function prependBits(number: bigint, bits: string): bigint {
	return (number << BigInt(bits.length)) | BigInt(`0b${bits.split("").reverse().join("")}`);
}

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function alphabetEncode(number: bigint): string {
	const base = BigInt(alphabet.length);
	let chunkBase = 1n, chunkOffset = 0n, chunkDigits = 0;
	// Peel multiple bijective base-84 digits per BigInt division, safely within
	// Number precision. This matters for document-sized handoffs.
	while (base * (chunkOffset + chunkBase) <= BigInt(Number.MAX_SAFE_INTEGER)) {
		chunkOffset += chunkBase;
		chunkBase *= base;
		chunkDigits++;
	}
	const output: string[] = [];
	while (number >= chunkOffset) {
		const adjusted = number - chunkOffset;
		let chunk = Number(adjusted % chunkBase);
		number = adjusted / chunkBase;
		for (let index = 0; index < chunkDigits; index++) {
			output.push(alphabet[chunk % alphabet.length]);
			chunk = Math.floor(chunk / alphabet.length);
		}
	}
	while (number > 0n) {
		number--;
		output.push(alphabet[Number(number % base)]);
		number /= base;
	}
	return output.join("");
}

/** Called only by Edit: opens a normal document, not an auto-executing JS link. */
export function lnkrEditUrl(text: string, kind: LnkrKind): string {
	const bytes = new TextEncoder().encode(text);
	const compressed = deflate(bytes, { level: 9 });
	const hex = Array.from(compressed, byte => byte.toString(16).padStart(2, "0")).reverse().join("");
	let number = BigInt(`0x1${hex}`);
	number = prependBits(number, gammaBits(compressed.length + 1));
	number = prependBits(number, fixedBits(crc32(bytes), 32));
	number = prependBits(number, gammaBits(bytes.length + 1));
	number = prependBits(number, fixedBits(kinds[kind], 2));
	number = prependBits(number, fixedBits(4, 3));
	number = prependBits(number, fixedBits(0x4c4e, 16));
	const url = new URL("https://a.shel.sh/");
	// The alphabet itself includes #; keep it even when it is the first digit.
	url.hash = `#${alphabetEncode(number)}`;
	return url.href;
}
