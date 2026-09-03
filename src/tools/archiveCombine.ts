import JSZip, { type JSZipObject } from "jszip";
import { parseTar } from "nanotar";

export const MAX_ARCHIVE_ENTRIES = 20_000;
export const MAX_TEXT_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_INFLATED_BYTES = 512 * 1024 * 1024;
export const MAX_COMBINED_TEXT_BYTES = 64 * 1024 * 1024;

export interface CombinedArchiveEntry {
	path: string;
	size: number;
	language: string;
	text?: string;
	omittedReason?: string;
}

export interface CombinedArchive {
	markdown: string;
	entries: CombinedArchiveEntry[];
	included: number;
	omitted: number;
}

interface RawArchiveEntry {
	path: string;
	size: number;
	read: () => Promise<Uint8Array>;
	omittedReason?: string;
}

interface ZipObjectWithSize extends JSZipObject {
	_data?: {
		uncompressedSize?: number;
	};
}

const BINARY_EXTENSIONS = new Set([
	"7z", "a", "apk", "appimage", "avi", "avif", "bin", "bmp", "bz2", "class", "db", "dll",
	"dmg", "doc", "docx", "dylib", "eot", "exe", "flac", "gif", "gz", "heic", "ico", "iso",
	"jar", "jpeg", "jpg", "lib", "m4a", "m4v", "mkv", "mov", "mp3", "mp4", "o", "obj", "ogg",
	"otf", "pdf", "png", "ppt", "pptx", "pyc", "rar", "so", "sqlite", "sqlite3", "tar", "tif",
	"tiff", "ttf", "wav", "webm", "webp", "woff", "woff2", "xls", "xlsx", "xz", "zip", "zst"
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
	asm: "asm", bat: "bat", c: "c", cc: "cpp", clj: "clojure", cljs: "clojure", cmd: "bat",
	coffee: "coffeescript", cpp: "cpp", cs: "csharp", css: "css", csv: "csv", cxx: "cpp", dart: "dart",
	dockerfile: "dockerfile", ex: "elixir", exs: "elixir", fs: "fsharp", fsx: "fsharp", go: "go",
	graphql: "graphql", gql: "graphql", h: "c", hpp: "cpp", htm: "html", html: "html", ini: "ini",
	java: "java", js: "javascript", json: "json", json5: "json5", jsx: "jsx", kt: "kotlin", kts: "kotlin",
	less: "less", lua: "lua", md: "markdown", markdown: "markdown", mjs: "javascript", php: "php",
	pl: "perl", ps1: "powershell", py: "python", r: "r", rb: "ruby", rs: "rust", sass: "sass",
	scala: "scala", scss: "scss", sh: "bash", sql: "sql", svelte: "svelte", swift: "swift",
	toml: "toml", ts: "typescript", tsx: "tsx", txt: "text", vue: "vue", xml: "xml", yaml: "yaml",
	yml: "yaml", zig: "zig"
};

function extensionFor(path: string): string {
	const leaf = path.split("/").at(-1)?.toLowerCase() || "";
	if (leaf === "dockerfile" || leaf === "makefile") return leaf;
	return leaf.includes(".") ? leaf.split(".").at(-1) || "" : "";
}

export function languageForPath(path: string): string {
	const extension = extensionFor(path);
	if (extension === "makefile") return "makefile";
	return LANGUAGE_BY_EXTENSION[extension] || "text";
}

export function normalizeArchivePath(input: string): string {
	const normalized = input
		.replace(/[\u0000-\u001f\u007f]/g, "_")
		.replaceAll("\\", "/")
		.replace(/^[A-Za-z]:/, "");
	const parts = normalized
		.split("/")
		.filter(part => part && part !== ".")
		.map(part => part === ".." ? "_parent_" : part);
	return parts.join("/") || "unnamed";
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function binaryReason(path: string, bytes: Uint8Array): string | undefined {
	if (BINARY_EXTENSIONS.has(extensionFor(path))) return "binary file";
	if (bytes.length >= 2 && (
		(bytes[0] === 0xff && bytes[1] === 0xfe)
		|| (bytes[0] === 0xfe && bytes[1] === 0xff)
	)) return undefined;
	if (bytes.includes(0)) return "binary data";

	const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
	let suspiciousControls = 0;
	for (const byte of sample) {
		if (byte < 9 || (byte > 13 && byte < 32)) suspiciousControls += 1;
	}
	if (sample.length && suspiciousControls / sample.length > 0.02) return "binary data";
	return undefined;
}

function decodeText(bytes: Uint8Array): string | undefined {
	try {
		if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
			return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
		}
		if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
			const swapped = new Uint8Array(bytes.length - 2);
			for (let index = 2; index + 1 < bytes.length; index += 2) {
				swapped[index - 2] = bytes[index + 1];
				swapped[index - 1] = bytes[index];
			}
			return new TextDecoder("utf-16le", { fatal: true }).decode(swapped);
		}
		const start = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start));
	} catch {
		return undefined;
	}
}

function longestBacktickRun(text: string): number {
	let longest = 0;
	let current = 0;
	for (const char of text) {
		if (char === "`") {
			current += 1;
			longest = Math.max(longest, current);
		} else {
			current = 0;
		}
	}
	return longest;
}

export function renderCombinedMarkdown(entries: CombinedArchiveEntry[]): string {
	return entries.map(entry => {
		const heading = `## File: ./${entry.path}`;
		if (entry.omittedReason) {
			return `${heading}\n\n(omitted — ${entry.omittedReason}, ${formatBytes(entry.size)})\n\n***`;
		}

		const text = entry.text || "";
		const fence = "`".repeat(Math.max(3, longestBacktickRun(text) + 1));
		const trailingNewline = text.endsWith("\n") || text.length === 0 ? "" : "\n";
		return `${heading}\n\n${fence}${entry.language}\n${text}${trailingNewline}${fence}\n\n***`;
	}).join("\n\n") + (entries.length ? "\n" : "");
}

async function readZipEntries(file: File): Promise<RawArchiveEntry[]> {
	const archive = await JSZip.loadAsync(new Uint8Array(await file.arrayBuffer()));
	const entries: RawArchiveEntry[] = [];
	archive.forEach((path, value) => {
		if (value.dir) return;
		const sizedValue = value as ZipObjectWithSize;
		const size = sizedValue._data?.uncompressedSize ?? -1;
		entries.push({
			path,
			size,
			read: () => value.async("uint8array")
		});
	});
	return entries;
}

async function readTarEntries(file: File): Promise<RawArchiveEntry[]> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const parsed = parseTar(bytes);
	return parsed
		.filter(entry => entry.type !== "directory")
		.map(entry => ({
			path: entry.name,
			size: entry.size,
			read: async () => entry.data || new Uint8Array(),
			omittedReason: entry.type === undefined || entry.type === "file" || entry.type === "contiguousFile"
				? undefined
				: `${entry.type} entry`
		}));
}

function isZip(file: Pick<File, "name" | "type">): boolean {
	return file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
}

function isTar(file: Pick<File, "name" | "type">): boolean {
	return /\.tar$/i.test(file.name) || file.type === "application/x-tar";
}

export function isSupportedArchive(file: Pick<File, "name" | "type">): boolean {
	return isZip(file) || isTar(file);
}

export async function combineArchive(file: File): Promise<CombinedArchive> {
	if (file.size > MAX_TOTAL_INFLATED_BYTES) {
		throw new Error(`The archive itself exceeds the ${formatBytes(MAX_TOTAL_INFLATED_BYTES)} safety limit.`);
	}
	let rawEntries: RawArchiveEntry[];
	if (isZip(file)) rawEntries = await readZipEntries(file);
	else if (isTar(file)) rawEntries = await readTarEntries(file);
	else throw new Error("Choose a ZIP or TAR archive.");

	if (rawEntries.length > MAX_ARCHIVE_ENTRIES) {
		throw new Error(`The archive contains ${rawEntries.length.toLocaleString()} files; the safe limit is ${MAX_ARCHIVE_ENTRIES.toLocaleString()}.`);
	}

	rawEntries.sort((left, right) => normalizeArchivePath(left.path).localeCompare(normalizeArchivePath(right.path)));
	const entries: CombinedArchiveEntry[] = [];
	let inflatedBytes = 0;
	let combinedTextBytes = 0;

	for (const raw of rawEntries) {
		const path = normalizeArchivePath(raw.path);
		const knownSize = Math.max(0, raw.size);
		inflatedBytes += knownSize;
		if (inflatedBytes > MAX_TOTAL_INFLATED_BYTES) {
			throw new Error(`The expanded archive exceeds the ${formatBytes(MAX_TOTAL_INFLATED_BYTES)} safety limit.`);
		}

		if (knownSize > MAX_TEXT_FILE_BYTES) {
			entries.push({ path, size: knownSize, language: languageForPath(path), omittedReason: "file exceeds text limit" });
			continue;
		}
		if (raw.omittedReason) {
			entries.push({ path, size: knownSize, language: languageForPath(path), omittedReason: raw.omittedReason });
			continue;
		}
		if (BINARY_EXTENSIONS.has(extensionFor(path))) {
			entries.push({ path, size: knownSize, language: languageForPath(path), omittedReason: "binary file" });
			continue;
		}

		const bytes = await raw.read();
		if (raw.size < 0) inflatedBytes += bytes.length;
		if (inflatedBytes > MAX_TOTAL_INFLATED_BYTES) {
			throw new Error(`The expanded archive exceeds the ${formatBytes(MAX_TOTAL_INFLATED_BYTES)} safety limit.`);
		}
		if (bytes.length > MAX_TEXT_FILE_BYTES) {
			entries.push({ path, size: bytes.length, language: languageForPath(path), omittedReason: "file exceeds text limit" });
			continue;
		}

		const reason = binaryReason(path, bytes);
		const text = reason ? undefined : decodeText(bytes);
		if (reason || text === undefined) {
			entries.push({ path, size: bytes.length, language: languageForPath(path), omittedReason: reason || "unsupported text encoding" });
			continue;
		}

		const textBytes = new TextEncoder().encode(text).length;
		if (combinedTextBytes + textBytes > MAX_COMBINED_TEXT_BYTES) {
			entries.push({ path, size: bytes.length, language: languageForPath(path), omittedReason: "combined document limit reached" });
			continue;
		}
		combinedTextBytes += textBytes;
		entries.push({ path, size: bytes.length, language: languageForPath(path), text });
	}

	return {
		markdown: renderCombinedMarkdown(entries),
		entries,
		included: entries.filter(entry => entry.text !== undefined).length,
		omitted: entries.filter(entry => entry.omittedReason !== undefined).length
	};
}
