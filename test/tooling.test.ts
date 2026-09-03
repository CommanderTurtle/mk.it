import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import { createTar } from "nanotar";

import { combineArchive, isSupportedArchive, normalizeArchivePath, renderCombinedMarkdown } from "../src/tools/archiveCombine";
import { base64DataUrl, decodeBase64, encodeBase64, filenameForFormat } from "../src/tools/base64";
import { buildMarkdownPreviewDocument, documentPreviewKind } from "../src/tools/documentPreview";
import { buildOcrViewerDocument, flattenOcrWords } from "../src/tools/ocr";
import { hashBytes, md5Hex } from "../src/tools/hashes";
import { imageViewerEval, imageViewerSource } from "../src/tools/imageViewer";
import {
	decodeSharedFile,
	encodeSharedFile,
	isSharePreviewHash,
	mediaEmbedHtml,
	previewKind,
	sharePayloadFromHash,
	sharePreviewUrl,
	shareUrl
} from "../src/tools/share";
import { sourcePreview } from "../src/tools/sourcePreview";

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

	test("encodes large byte arrays and MIME-correct data URLs losslessly", () => {
		const bytes = Uint8Array.from({ length: 80_003 }, (_, index) => index % 251);
		const encoded = encodeBase64(bytes);
		expect([...decodeBase64(encoded).bytes]).toEqual([...bytes]);
		expect(base64DataUrl(Uint8Array.of(60, 62), "image/svg+xml")).toBe("data:image/svg+xml;base64,PD4=");
	});
});

describe("fragment file sharing", () => {
	test("hashes the exact file bytes with standard checksum algorithms", async () => {
		const bytes = new TextEncoder().encode("abc");
		expect(await hashBytes(bytes)).toEqual({
			sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
			md5: "900150983cd24fb0d6963f7d28e17f72",
			sha1: "a9993e364706816aba3e25717850c26c9cd0d89d"
		});
		expect(md5Hex(new Uint8Array())).toBe("d41d8cd98f00b204e9800998ecf8427e");
	});

	test("round-trips exact binary bytes, Unicode metadata, and a portable URL", () => {
		const file = {
			name: "misty-rainbow-雪.webp",
			mime: "image/webp",
			bytes: Uint8Array.of(0, 1, 2, 127, 128, 254, 255)
		};
		const payload = encodeSharedFile(file);
		expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeSharedFile(payload)).toEqual(file);
		const url = shareUrl(file, "https://app.shel.sh/make/");
		expect(url).toStartWith("https://app.shel.sh/make/#share:");
		expect(sharePayloadFromHash(new URL(url).hash)).toBe(payload);
		const preview = sharePreviewUrl(file, "https://app.shel.sh/make/");
		expect(preview).toStartWith("https://app.shel.sh/make/#p:");
		expect(isSharePreviewHash(new URL(preview).hash)).toBe(true);
		expect(sharePayloadFromHash(new URL(preview).hash)).toBe(payload);
	});

	test("builds direct HTML and GFM preview documents only for document formats", () => {
		expect(documentPreviewKind({ name: "report.md", mime: "application/octet-stream" })).toBe("markdown");
		expect(documentPreviewKind({ name: "page.bin", mime: "text/html" })).toBe("html");
		expect(documentPreviewKind({ name: "photo.png", mime: "image/png" })).toBeNull();
		const preview = buildMarkdownPreviewDocument("# Report\n\n| A | B |\n|-|-|\n| 1 | 2 |", "report.md");
		expect(preview).toContain("<h1>Report</h1>");
		expect(preview).toContain("<table>");
		expect(preview).toContain("<title>report.md</title>");
	});

	test("classifies native previews and emits self-contained media HTML", () => {
		const svg = {
			name: "sample.svg",
			mime: "image/svg+xml",
			bytes: new TextEncoder().encode("<svg><rect width=\"2\" height=\"2\"/></svg>")
		};
		expect(previewKind(svg.mime)).toBe("image");
		expect(mediaEmbedHtml(svg)).toContain('<img src="data:image/svg+xml;base64,');
		const source = sourcePreview(svg);
		expect(source?.text).toContain("<rect");
		expect(source?.language).toBe("xml");
		expect(source?.html).toContain("hljs-tag");
		expect(sourcePreview({ name: "tool.bin", mime: "application/octet-stream", bytes: Uint8Array.of(0, 1, 2) })).toBeNull();
	});

	test("covers browser image, video, audio, and PDF preview elements", () => {
		const bytes = Uint8Array.of(0, 1, 2);
		for (const mime of ["image/png", "image/jpeg", "image/avif", "image/webp", "image/gif"]) {
			const file = { name: `fixture.${mime.split("/")[1]}`, mime, bytes };
			expect(previewKind(mime)).toBe("image");
			expect(mediaEmbedHtml(file)).toStartWith(`<img src="data:${mime};base64,`);
			expect(imageViewerEval(file)).toContain(`data:${mime};base64,AAEC`);
		}
		for (const mime of ["video/mp4", "video/webm", "video/ogg"]) {
			expect(previewKind(mime)).toBe("video");
			expect(mediaEmbedHtml({ name: "clip", mime, bytes })).toStartWith(`<video controls src="data:${mime};base64,`);
		}
		for (const mime of ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac"]) {
			expect(previewKind(mime)).toBe("audio");
			expect(mediaEmbedHtml({ name: "sound", mime, bytes })).toStartWith(`<audio controls src="data:${mime};base64,`);
		}
		expect(previewKind("application/pdf")).toBe("pdf");
		expect(mediaEmbedHtml({ name: "paper.pdf", mime: "application/pdf", bytes })).toStartWith('<iframe src="data:application/pdf;base64,');
	});

	test("reuses ln.kr's self-contained pan-and-zoom image evaluation", () => {
		const source = imageViewerSource("data:image/png;base64,AAEC");
		expect(source).toContain("scale = Math.min(10, scale * 1.25)");
		expect(source).toContain("box.addEventListener('wheel'");
		expect(source).toContain("img.referrerPolicy = 'no-referrer'");
		expect(source).toEndWith(')("data:image/png;base64,AAEC");');
		expect(imageViewerEval({ name: "not-image.mp4", mime: "video/mp4", bytes: Uint8Array.of() })).toBeNull();
	});

	test("rejects damaged share records", () => {
		expect(() => decodeSharedFile("bm90LWEtc2hhcmUtcmVjb3Jk")).toThrow("damaged or unsupported");
	});
});

describe("archive combiner", () => {
	test("recognizes ZIP and uncompressed TAR inputs by name or MIME", () => {
		expect(isSupportedArchive({ name: "source.zip", type: "" })).toBe(true);
		expect(isSupportedArchive({ name: "source.bin", type: "application/x-tar" })).toBe(true);
		expect(isSupportedArchive({ name: "source.7z", type: "application/x-7z-compressed" })).toBe(false);
	});
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
