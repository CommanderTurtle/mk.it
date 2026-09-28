import { expect, test } from "bun:test";
import JSZip from "jszip";
import { renderCombinedMarkdown } from "../src/tools/archiveCombine";
import { parseCombinedMarkdown, combinedZipBytes } from "../src/tools/combined-markdown.js";
import { buildMarkdownPreviewDocument } from "../src/tools/documentPreview";

test("combined.md reverses to a ZIP with exact text, nested fences, and directories", async () => {
  const text = "# Nested\n\n````md\n```js\nx()\n```\n````\n\n\n\nEnd";
  const source = renderCombinedMarkdown([
    { path: "docs/readme.md", text, language: "markdown", size: text.length },
    { path: "empty.txt", text: "", language: "text", size: 0 },
    { path: "image.png", omittedReason: "binary file", size: 12, language: "text" },
  ]);
  const result = parseCombinedMarkdown(source)!;
  expect(result.included).toBe(2);
  expect(result.omitted).toBe(1);
  const zip = await JSZip.loadAsync(combinedZipBytes(result.entries), { checkCRC32: true });
  expect(await zip.file("docs/readme.md")!.async("string")).toBe(text);
  expect(await zip.file("empty.txt")!.async("string")).toBe("");
  expect(zip.file("image.png")).toBeNull();
  const html = buildMarkdownPreviewDocument(source);
  expect(html).toContain("```js");
  expect(html.match(/<pre>/g)).toHaveLength(2);
});
