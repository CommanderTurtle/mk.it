import mime from "mime";
import { deflate, inflate } from "pako";

import { base64DataUrl, decodeBase64, encodeBase64 } from "./base64";

export interface SharedFileData {
	name: string;
	mime: string;
	bytes: Uint8Array;
}

export type MediaPreviewKind = "image" | "video" | "audio" | "pdf";

const SHARE_PREFIX = "#share:";
const MAGIC = Uint8Array.of(0x4d, 0x4b, 0x49, 0x54, 0x01); // MKIT + version 1
const HEADER_LENGTH = MAGIC.length + 4;
const MIME_PATTERN = /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+(?:\s*;[^\r\n]*)?$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function equalMagic(bytes: Uint8Array): boolean {
	return MAGIC.every((value, index) => bytes[index] === value);
}

function normalizedMime(value: string | undefined, name = ""): string {
	const explicit = value?.trim();
	if (explicit && MIME_PATTERN.test(explicit)) return explicit;
	return mime.getType(name) || "application/octet-stream";
}

export function fileMime(file: Pick<File, "name" | "type">): string {
	return normalizedMime(file.type, file.name);
}

export function encodeSharedFile(file: SharedFileData): string {
	const metadata = encoder.encode(JSON.stringify({
		name: file.name || "shared-file",
		mime: normalizedMime(file.mime, file.name)
	}));
	const record = new Uint8Array(HEADER_LENGTH + metadata.length + file.bytes.length);
	record.set(MAGIC, 0);
	new DataView(record.buffer).setUint32(MAGIC.length, metadata.length, false);
	record.set(metadata, HEADER_LENGTH);
	record.set(file.bytes, HEADER_LENGTH + metadata.length);

	return encodeBase64(deflate(record, { level: 9 }))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/g, "");
}

export function decodeSharedFile(payload: string): SharedFileData {
	let record: Uint8Array;
	try {
		record = inflate(decodeBase64(payload).bytes);
	} catch (error) {
		throw new Error("This mk.it share payload is damaged or unsupported.", { cause: error });
	}

	if (record.length < HEADER_LENGTH || !equalMagic(record)) {
		throw new Error("This is not an mk.it share payload.");
	}
	const metadataLength = new DataView(record.buffer, record.byteOffset, record.byteLength)
		.getUint32(MAGIC.length, false);
	const dataOffset = HEADER_LENGTH + metadataLength;
	if (metadataLength < 2 || dataOffset > record.length) {
		throw new Error("The mk.it share metadata is incomplete.");
	}

	let metadata: unknown;
	try {
		metadata = JSON.parse(decoder.decode(record.subarray(HEADER_LENGTH, dataOffset)));
	} catch (error) {
		throw new Error("The mk.it share metadata is invalid.", { cause: error });
	}
	if (
		typeof metadata !== "object" || metadata === null
		|| typeof (metadata as { name?: unknown }).name !== "string"
		|| typeof (metadata as { mime?: unknown }).mime !== "string"
	) {
		throw new Error("The mk.it share metadata has an unsupported shape.");
	}
	const { name, mime: metadataMime } = metadata as { name: string; mime: string };
	return {
		name: name || "shared-file",
		mime: normalizedMime(metadataMime, name),
		bytes: record.slice(dataOffset)
	};
}

export function shareFragment(file: SharedFileData): string {
	return `${SHARE_PREFIX}${encodeSharedFile(file)}`;
}

export function sharePayloadFromHash(hash: string): string | null {
	return hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : null;
}

export function shareUrl(file: SharedFileData, baseUrl: string): string {
	const url = new URL(baseUrl);
	url.hash = shareFragment(file).slice(1);
	return url.href;
}

export function previewKind(mimeType: string): MediaPreviewKind | null {
	const bare = mimeType.split(";", 1)[0].toLowerCase();
	if (bare.startsWith("image/")) return "image";
	if (bare.startsWith("video/")) return "video";
	if (bare.startsWith("audio/")) return "audio";
	if (bare === "application/pdf") return "pdf";
	return null;
}

function escapeAttribute(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export function mediaEmbedHtml(file: SharedFileData): string | null {
	const kind = previewKind(file.mime);
	if (!kind) return null;
	const source = escapeAttribute(base64DataUrl(file.bytes, file.mime));
	const name = escapeAttribute(file.name);
	if (kind === "image") return `<img src="${source}" alt="${name}">`;
	if (kind === "video") return `<video controls src="${source}"></video>`;
	if (kind === "audio") return `<audio controls src="${source}"></audio>`;
	return `<iframe src="${source}" title="${name}"></iframe>`;
}

export async function fileDataUrl(file: File): Promise<string> {
	return base64DataUrl(new Uint8Array(await file.arrayBuffer()), fileMime(file));
}
