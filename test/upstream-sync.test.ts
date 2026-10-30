import { expect, test } from "bun:test";
import CommonFormats from "../src/CommonFormats.ts";
import { type ConvertPathNode } from "../src/FormatHandler.ts";
import PriorityQueue from "../src/PriorityQueue.ts";
import { TraversionGraph } from "../src/TraversionGraph.ts";
import textEncodingHandler from "../src/handlers/textEncoding.ts";
import configHandler from "../src/handlers/config.ts";
import sqliteHandler from "../src/handlers/sqlite.ts";
import { jsPDF } from "jspdf";

test("UTF-16 preserves supplementary characters in both byte orders", async () => {
  const handler = new textEncodingHandler();
  const text = "A雪🎵𝄞Z";
  for (const internal of ["utf16le", "utf16be"]) {
    const target = handler.supportedFormats.find((format) => format.internal === internal)!;
    const [encoded] = await handler.doConvert(
      [{ name: "unicode.txt", bytes: new TextEncoder().encode(text) }],
      CommonFormats.TEXT.supported("txt", true, true), target,
    );
    expect(encoded.bytes.length).toBe(text.length * 2 + 2);
    const [decoded] = await handler.doConvert([encoded], target,
      handler.supportedFormats.find((format) => format.internal === "utf8NB")!);
    expect(new TextDecoder().decode(decoded.bytes)).toBe(text);
  }
});

test("UTF-32 emits the correct BOM in both byte orders", async () => {
  const handler = new textEncodingHandler();
  for (const [internal, bom] of [
    ["utf32le", [255, 254, 0, 0]], ["utf32be", [0, 0, 254, 255]],
  ] as const) {
    const target = handler.supportedFormats.find((format) => format.internal === internal)!;
    const [encoded] = await handler.doConvert(
      [{ name: "unicode.txt", bytes: new TextEncoder().encode("A🎵") }],
      CommonFormats.TEXT.supported("txt", true, true), target,
    );
    expect([...encoded.bytes.subarray(0, 4)]).toEqual([...bom]);
  }
});

test("comparable priority queues keep the smallest child when sinking", () => {
  const queue = new PriorityQueue<String>();
  for (const value of ["a", "b", "c", "d"]) queue.add(new String(value));
  expect(Array.from({ length: 4 }, () => String(queue.poll()))).toEqual(["a", "b", "c", "d"]);
});

test("adaptive category costs apply once to an image/audio transition", () => {
  const graph = new TraversionGraph();
  graph.addCategoryAdaptiveCost(["image", "audio"], 123);
  const path = ["image", "audio", "audio"].map((category) => ({
    handler: { name: "fixture" }, format: { category, mime: `${category}/fixture` },
  })) as ConvertPathNode[];
  const calculate = (nodes: ConvertPathNode[]) =>
    (graph as unknown as { calculateAdaptiveCosts(path: ConvertPathNode[]): { cost: number }[] })
      .calculateAdaptiveCosts(nodes).some((entry) => entry.cost === 123);
  expect(calculate(path.slice(0, 2))).toBe(true);
  expect(calculate(path)).toBe(false);
});

test("compact JSON retains nested YAML structure with the updated confbox", async () => {
  const handler = new configHandler();
  const json = { nested: { list: [1, 2], enabled: true } };
  const input = CommonFormats.JSON.supported("json", true, true);
  const yaml = handler.supportedFormats.find((format) => format.internal === "yaml")!;
  const [encoded] = await handler.doConvert(
    [{ name: "config.json", bytes: new TextEncoder().encode(JSON.stringify(json)) }], input, yaml,
  );
  const [decoded] = await handler.doConvert([encoded], yaml, input);
  expect(JSON.parse(new TextDecoder().decode(decoded.bytes))).toEqual(json);
});

test("CSV/SQLite round trips preserve the first character of text and numeric values", async () => {
  const handler = new sqliteHandler();
  await handler.init();
  const csv = handler.supportedFormats!.find((format) => format.internal === "csv")!;
  const sqlite = handler.supportedFormats!.find((format) => format.internal === "sqlite3")!;
  const encoded = await handler.doConvert(
    [{ name: "people.csv", bytes: new TextEncoder().encode("name,age\nAlice,42\nBob,17\n") }], csv, sqlite,
  );
  const [decoded] = await handler.doConvert(encoded, sqlite, csv);
  expect(new TextDecoder().decode(decoded.bytes)).toBe("name,age\nAlice, 42\nBob, 17\n");
});

test("PDFKit's browser entry registers the bundled Courier font", async () => {
  const { default: PDFDocument, registerStdFonts } = await import(
    new URL("pdfkit.browser.mjs", import.meta.resolve("pdfkit")).href
  );
  const { default: Courier } = await import("pdfkit/standard-fonts/Courier");
  registerStdFonts(Courier);
  const doc = new PDFDocument({ font: "Courier" });
  const chunks: Uint8Array[] = [];
  const finished = new Promise<void>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", resolve);
    doc.on("error", reject);
  });
  doc.text("Local text export");
  doc.end();
  await finished;
  expect(new TextDecoder().decode(chunks[0].subarray(0, 5))).toBe("%PDF-");
});

test("jsPDF retains the image/PDF export API used by the slide renderer", () => {
  const doc = new jsPDF({ unit: "pt", format: [640, 360] });
  doc.addImage({ imageData: { data: new Uint8ClampedArray([255, 0, 0, 255]), width: 1, height: 1 },
    format: "RGBA", x: 0, y: 0, width: 640, height: 360 });
  expect(new TextDecoder().decode(new Uint8Array(doc.output("arraybuffer")).subarray(0, 5))).toBe("%PDF-");
});
