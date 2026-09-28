import SevenZip, { type SevenZipModuleFactory } from "7z-wasm";
import type { RawArchiveEntry } from "./archiveCombine";

interface Limits {
	maxEntries: number;
	maxInflatedBytes: number;
	maxTextBytes: number;
	isBinary: (path: string) => boolean;
}

// Only the in-memory WASM filesystem is used; never mount a host filesystem.
export async function readSevenZipEntries(file: File, limits: Limits, factory: SevenZipModuleFactory = SevenZip): Promise<RawArchiveEntry[]> {
	let output: string[] = [];
	let outputLength = 0;
	const capture = (line: string) => {
		outputLength += line.length;
		if (outputLength > 8 * 1024 * 1024) throw new Error("Archive listing exceeds the preview safety limit.");
		output.push(line);
	};
	const engine = await factory({
		locateFile: () => `${import.meta.env.BASE_URL || "/make/"}wasm/7zz.wasm`,
		print: capture, printErr: capture, stdin: () => -1
	});
	const run = (args: string[]) => {
		output = []; outputLength = 0;
		const code = engine.callMain([...args, "-bd", "-bsp0", "-sccUTF-8", "-p__no_preview_password__"]) as unknown as number;
		if (code !== 0) throw new Error("Cannot preview this 7z archive. It may be damaged or password-protected.");
		return output.join("\n");
	};
	engine.FS.writeFile("/input.7z", new Uint8Array(await file.arrayBuffer()));
	const listing = run(["l", "/input.7z", "-slt", "-ba"]);
	const entries: RawArchiveEntry[] = [];
	const seen = new Set<string>();
	let inflated = 0;
	for (const block of listing.trim().split(/\r?\n\s*\r?\n/)) {
		if (!block) continue;
		const fields = new Map<string, string>();
		for (const line of block.split(/\r?\n/)) {
			const at = line.indexOf(" = ");
			if (at < 1 || fields.has(line.slice(0, at))) throw new Error("Ambiguous archive listing; preview skipped.");
			fields.set(line.slice(0, at), line.slice(at + 3));
		}
		const path = fields.get("Path");
		if (!path || /[\u0000-\u001f\u007f:\\]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) {
			throw new Error("Unsafe archive path; preview skipped.");
		}
		if (seen.has(path.toLowerCase())) throw new Error("Duplicate archive path; preview skipped.");
		seen.add(path.toLowerCase());
		if (seen.size > limits.maxEntries) throw new Error("Archive contains too many entries to preview.");
		const size = Number(fields.get("Size"));
		if (!fields.has("Size") || !Number.isSafeInteger(size) || size < 0) throw new Error("Archive entry size is invalid.");
		inflated += size;
		if (inflated > limits.maxInflatedBytes) throw new Error("Expanded archive exceeds the preview safety limit.");
		const attributes = fields.get("Attributes") || "";
		if (attributes.startsWith("D") || fields.get("Folder") === "+") continue;
		const omittedReason = fields.get("Encrypted") === "+" ? "password-protected file"
			: fields.has("Symbolic Link") || fields.has("Hard Link") || /(?:^| )l[rwx-]{9}/.test(attributes) ? "link entry"
			: size > limits.maxTextBytes ? "file exceeds text limit"
			: limits.isBinary(path) ? "binary file" : undefined;
		entries.push({ path, size, omittedReason, read: async () => engine.FS.readFile(`/out/${path}`) });
	}
	const selected = entries.filter(entry => !entry.omittedReason);
	if (selected.length) {
		engine.FS.mkdir("/out");
		engine.FS.writeFile("/selected.txt", selected.map(entry => entry.path).join("\n"));
		run(["x", "/input.7z", "-o/out", "-y", "-i@/selected.txt", "-scsUTF-8", "-spd"]);
		for (const entry of selected) {
			const stat = engine.FS.lstat(`/out/${entry.path}`);
			if (!engine.FS.isFile(stat.mode) || stat.size !== entry.size) throw new Error("Archive entry differs from its listing; preview skipped.");
		}
	}
	return entries;
}
