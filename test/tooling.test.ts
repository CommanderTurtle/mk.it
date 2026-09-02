import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import { createTar } from "nanotar";

import { combineArchive, normalizeArchivePath, renderCombinedMarkdown } from "../src/tools/archiveCombine";
import { decodeBase64, filenameForFormat } from "../src/tools/base64";
import { buildOcrViewerDocument, flattenOcrWords } from "../src/tools/ocr";

describe("base64 input", () => {
	test("decodes plain, whitespace, URL-safe, and data URL input", () => {
		expect(new TextDecoder().decode(decodeBase64("SGVsbG8gV29ybGQ=").bytes)).toBe("Hello World");
		expect(new TextDecoder().decode(decodeBase64("SGVs\n bG8=").bytes)).toBe("Hello");
		expect([...decodeBase64("-_8").bytes]).toEqual([251, 255]);
		const dataUrl = decodeBase64("data:text/plain;charset=utf-8;base64,SGVsbG8=");
		expect(dataUrl.mime).toBe("text/plain");
		expect(new TextDecoder().decode(dataUrl.bytes)).toBe("Hello");
	});

	test("rejects malformed payloads and normalizes download names", () => {
		expect(() => decodeBase64("A")).toThrow("invalid length");
		expect(() => decodeBase64("not*base64")).toThrow("not valid base64");
		expect(() => decodeBase64("data:text/plain,hello")).toThrow("not base64 encoded");
		expect(filenameForFormat("folder\\report.old", "pdf")).toBe("report.pdf");
		expect(filenameForFormat("already.JSON", ".json")).toBe("already.JSON");
	});
});

describe("archive combiner", () => {
	test("combines ZIP source text and keeps explicit binary omissions", async () => {
		const zip = new JSZip();
		zip.file("src/main.ts", "console.log('ok');\n````\n");
		zip.file("README.md", "# Fixture\n");
		zip.file("build/tool.dll", new Uint8Array([77, 90, 0, 1]));
		const bytes = await zip.generateAsync({ type: "uint8array" });
		const result = await combineArchive(new File([bytes as BlobPart], "fixture.zip", { type: "application/zip" }));

		expect(result.included).toBe(2);
		expect(result.omitted).toBe(1);
		expect(result.markdown).toContain("## File: ./README.md");
		expect(result.markdown).toContain("## File: ./src/main.ts");
		expect(result.markdown).toContain("(omitted — binary file");
		expect(result.markdown).toContain("`````typescript");
		expect(result.markdown.indexOf("README.md")).toBeLessThan(result.markdown.indexOf("src/main.ts"));
	});

	test("combines TAR source text without filesystem extraction", async () => {
		const bytes = createTar([
			{ name: "script.py", data: "print('hello')\n" },
			{ name: "nested/config.yml", data: "enabled: true\n" }
		]);
		const result = await combineArchive(new File([bytes as BlobPart], "fixture.tar", { type: "application/x-tar" }));

		expect(result.included).toBe(2);
		expect(result.omitted).toBe(0);
		expect(result.markdown).toContain("```python\nprint('hello')");
		expect(result.markdown).toContain("```yaml\nenabled: true");
	});

	test("normalizes unsafe labels and chooses fences longer than source runs", () => {
		expect(normalizeArchivePath("../src\\index.js")).toBe("_parent_/src/index.js");
		const markdown = renderCombinedMarkdown([{ path: "code.md", size: 7, language: "markdown", text: "`````\n" }]);
		expect(markdown).toContain("``````markdown");
	});
});

describe("OCR viewer", () => {
	test("flattens Tesseract words and emits an escaped selectable layer", () => {
		const words = flattenOcrWords([{
			paragraphs: [{ lines: [{ words: [{ text: "<hello>", confidence: 96.4, bbox: { x0: 10, y0: 20, x1: 70, y1: 40 } }] }] }]
		}]);
		expect(words).toHaveLength(1);
		const document = buildOcrViewerDocument("blob:test", 100, 100, words);
		expect(document).toContain("&lt;hello&gt;");
		expect(document).toContain("left:10%");
		expect(document).toContain("Selectable OCR text layer");
		expect(document).not.toContain("><hello><");
	});
});
