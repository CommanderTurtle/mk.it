import { expect, test } from "bun:test";
import SevenZip from "7z-wasm";
import { readSevenZipEntries } from "../src/tools/sevenZipArchive";
import { renderCombinedMarkdown } from "../src/tools/archiveCombine";
import { parseCombinedMarkdown } from "../src/tools/combined-markdown.js";
import { sharedArchiveFormat } from "../src/tools/sharedArchive";

const wasmBinary = await Bun.file(new URL("../node_modules/7z-wasm/7zz.wasm", import.meta.url)).arrayBuffer();
const factory: typeof SevenZip = options => SevenZip({ ...options, wasmBinary });
const limits = { maxEntries: 100, maxInflatedBytes: 1024 * 1024, maxTextBytes: 1024, isBinary: (path: string) => path.endsWith(".png") };

for (const compression of [0, 5]) test(`previews 7z at compression level ${compression} with exact text and binary omissions`, async () => {
	const engine = await factory({ print: () => {}, printErr: () => {} });
	engine.FS.mkdir("/docs");
	const text = "# Snow 雪\n\n```js\nhello();\n```\n\nEnd";
	engine.FS.writeFile("/docs/README.md", text);
	engine.FS.writeFile("/image.png", Uint8Array.of(0, 1, 255));
	engine.callMain(["a", "/fixture.7z", "/docs", "/image.png", `-mx=${compression}`, "-bd", "-bsp0"]);
	const bytes = engine.FS.readFile("/fixture.7z");
	expect(sharedArchiveFormat({ name: "decoded.bin", mime: "application/octet-stream", bytes })).toBe("7z");
	const file = new File([bytes as BlobPart], "fixture.7z");
	const entries = await readSevenZipEntries(file, limits, factory);
	expect(new TextDecoder().decode(await entries.find(entry => entry.path === "docs/README.md")!.read())).toBe(text);
	expect(entries.find(entry => entry.path === "image.png")?.omittedReason).toBe("binary file");
	const markdown = renderCombinedMarkdown(await Promise.all(entries.map(async entry => ({
		...entry, language: "markdown", text: entry.omittedReason ? undefined : new TextDecoder().decode(await entry.read())
	}))));
	expect(parseCombinedMarkdown(markdown)?.entries.find(entry => entry.path === "docs/README.md")?.text).toBe(text);
	await expect(readSevenZipEntries(file, { ...limits, maxInflatedBytes: 1 }, factory)).rejects.toThrow("safety limit");
	await expect(readSevenZipEntries(file, { ...limits, maxEntries: 1 }, factory)).rejects.toThrow("too many entries");
});
