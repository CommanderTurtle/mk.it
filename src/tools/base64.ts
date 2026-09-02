export interface DecodedBase64 {
	bytes: Uint8Array;
	mime?: string;
}

const DATA_URL_PREFIX = /^data:([^,]*),/i;
const BASE64_ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;
const DECODE_CHUNK_SIZE = 32_768;

/**
 * Decode plain base64 or a base64 data URL without constructing one giant
 * binary string. Whitespace and the URL-safe alphabet are accepted.
 */
export function decodeBase64(input: string): DecodedBase64 {
	let payload = input.trim();
	let mime: string | undefined;

	const dataUrl = payload.match(DATA_URL_PREFIX);
	if (dataUrl) {
		const metadata = dataUrl[1];
		if (!metadata.split(";").some(part => part.toLowerCase() === "base64")) {
			throw new Error("The data URL is not base64 encoded.");
		}
		mime = metadata.split(";", 1)[0]?.trim() || undefined;
		payload = payload.slice(dataUrl[0].length);
	}

	payload = payload
		.replace(/[\t\n\f\r ]+/g, "")
		.replaceAll("-", "+")
		.replaceAll("_", "/");

	if (!payload) throw new Error("Paste a base64 payload first.");
	if (!BASE64_ALPHABET.test(payload)) {
		throw new Error("The payload contains characters that are not valid base64.");
	}
	if (payload.includes("=") && !/=+$/.test(payload)) {
		throw new Error("Base64 padding may only appear at the end.");
	}

	const remainder = payload.length % 4;
	if (remainder === 1) throw new Error("The base64 payload has an invalid length.");
	if (remainder) payload += "=".repeat(4 - remainder);

	const chunks: Uint8Array[] = [];
	let totalLength = 0;
	for (let offset = 0; offset < payload.length; offset += DECODE_CHUNK_SIZE) {
		const binary = atob(payload.slice(offset, offset + DECODE_CHUNK_SIZE));
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		chunks.push(bytes);
		totalLength += bytes.length;
	}

	const bytes = new Uint8Array(totalLength);
	let writeOffset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, writeOffset);
		writeOffset += chunk.length;
	}

	return { bytes, mime };
}

export function filenameForFormat(input: string, extension: string): string {
	const safeLeaf = (input.trim().split(/[\\/]/).at(-1) || "decoded")
		.replace(/[\u0000-\u001f<>:"|?*]/g, "_")
		.replace(/[. ]+$/g, "") || "decoded";
	const cleanExtension = extension.trim().replace(/^\.+/, "") || "bin";
	const expectedSuffix = `.${cleanExtension.toLowerCase()}`;

	if (safeLeaf.toLowerCase().endsWith(expectedSuffix)) return safeLeaf;
	const base = safeLeaf.replace(/\.[^.]+$/, "") || safeLeaf;
	return `${base}.${cleanExtension}`;
}
