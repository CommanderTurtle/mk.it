import { expect, test } from "bun:test";
import JSZip from "jszip";
import { base64DataUrl, decodeBase64 } from "../src/tools/base64";
import { hashBytes } from "../src/tools/hashes";
import { decodeSharedFile, encodeSharedFile } from "../src/tools/share";
import { previewSharedArchive, sharedArchiveFormat } from "../src/tools/sharedArchive";
import { combinedZipBytes, parseCombinedMarkdown } from "../src/tools/combined-markdown.js";

test("ZIP upload/Base64/share preserves the original while generating a browsable combined.md", async () => {
	const text = "# Readme\n\n```js\nconsole.log('nested');\n```\n\n\n\nEnd";
	const zip = new JSZip();
	zip.file("docs/README.md", text);
	zip.file("src/main.ts", "export const value = 1;\r\n");
	zip.file("image.png", Uint8Array.of(137, 80, 78, 71, 0, 255));
	const original = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
	const decoded = decodeBase64(base64DataUrl(original, "application/zip"));
	const shared = decodeSharedFile(encodeSharedFile({ name: "project.zip", mime: decoded.mime!, bytes: decoded.bytes }));
	const checksums = await hashBytes(shared.bytes);
	const result = await previewSharedArchive(shared);
	expect(result?.included).toBe(2);
	expect(result?.omitted).toBe(1);
	const bundle = parseCombinedMarkdown(result!.markdown)!;
	expect(bundle.entries.find(entry => entry.path === "docs/README.md")?.text).toBe(text);
	expect(bundle.entries.find(entry => entry.path === "src/main.ts")?.text).toBe("export const value = 1;\r\n");
	expect(bundle.entries.find(entry => entry.path === "image.png")?.omittedReason).toContain("binary file");
	const reconstructed = await JSZip.loadAsync(combinedZipBytes(bundle.entries), { checkCRC32: true });
	expect(await reconstructed.file("docs/README.md")!.async("string")).toBe(text);
	expect(reconstructed.file("image.png")).toBeNull();
	expect(shared.bytes).toEqual(original);
	expect(await hashBytes(shared.bytes)).toEqual(checksums);
	expect(shared.name).toBe("project.zip");
	expect(shared.mime).toBe("application/zip");
	const intact = await JSZip.loadAsync(shared.bytes, { checkCRC32: true });
	expect(await intact.file("image.png")!.async("uint8array")).toEqual(Uint8Array.of(137, 80, 78, 71, 0, 255));
});

test("detects ZIP filename, MIME aliases, or unnamed binary Base64 signatures", async () => {
	const bytes = await new JSZip().generateAsync({ type: "uint8array" });
	for (const [name, mime] of [
		["PROJECT.ZIP", "application/octet-stream"],
		["payload", "application/x-zip-compressed; charset=binary"],
		["decoded.bin", "application/octet-stream"],
		["decoded", ""],
	]) {
		const file = { name, mime, bytes };
		expect(sharedArchiveFormat(file)).toBe("zip");
		expect((await previewSharedArchive(file))?.entries).toEqual([]);
	}
	expect(sharedArchiveFormat({ name: "source.tar", mime: "application/octet-stream", bytes })).toBe("tar");
});

test("does not reinterpret other binary or ZIP-based document formats", async () => {
	const bytes = Uint8Array.of(0x50, 0x4b, 3, 4);
	for (const [name, mime] of [["report.docx", "application/octet-stream"], ["decoded", "image/png"], ["archive.rar", "application/vnd.rar"]]) {
		const file = { name, mime, bytes };
		expect(sharedArchiveFormat(file)).toBeNull();
		expect(await previewSharedArchive(file)).toBeNull();
	}
	expect(sharedArchiveFormat({ name: "file.bin", mime: "application/octet-stream", bytes: Uint8Array.of(1, 2, 3) })).toBeNull();
});

test("damaged ZIP previews reject without changing the downloadable bytes", async () => {
	const bytes = Uint8Array.of(0x50, 0x4b, 3, 4);
	const file = { name: "damaged.zip", mime: "application/zip", bytes };
	await expect(previewSharedArchive(file)).rejects.toThrow();
	expect(file.bytes).toEqual(Uint8Array.of(0x50, 0x4b, 3, 4));
});
