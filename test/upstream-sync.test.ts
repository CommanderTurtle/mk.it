import { expect, test } from "bun:test";
import CommonFormats from "../src/CommonFormats.ts";
import { type ConvertPathNode } from "../src/FormatHandler.ts";
import PriorityQueue from "../src/PriorityQueue.ts";
import { TraversionGraph } from "../src/TraversionGraph.ts";
import textEncodingHandler from "../src/handlers/textEncoding.ts";
import configHandler from "../src/handlers/config.ts";
import sqliteHandler from "../src/handlers/sqlite.ts";
import toonHandler from "../src/handlers/toon.ts";
import fontHandler from "../src/handlers/font.ts";
import pyTurtleHandler from "../src/handlers/pyTurtle.ts";
import { parse as parseFont } from "opentype.js";
import { jsPDF } from "jspdf";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

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

test("TOON 4 round trips nested records and ambiguous strings through the converter", async () => {
  const handler = new toonHandler();
  const json = handler.supportedFormats!.find((format) => format.internal === "json")!;
  const toon = handler.supportedFormats!.find((format) => format.internal === "toon")!;
  const data = { items: [{ name: "雪", value: 1 }, { name: "#tag", value: 2 }],
    nested: { active: true, empty: null }, label: "+12" };
  const encoded = await handler.doConvert(
    [{ name: "records.json", bytes: new TextEncoder().encode(JSON.stringify(data)) }], json, toon,
  );
  const [decoded] = await handler.doConvert(encoded, toon, json);
  expect(JSON.parse(new TextDecoder().decode(decoded.bytes))).toEqual(data);
});

test("updated SVG path/font libraries preserve the converter's glyph geometry", async () => {
  const handler = new fontHandler();
  await handler.init();
  const svg = handler.supportedFormats!.find((format) => format.internal === "svg")!;
  const otf = handler.supportedFormats!.find((format) => format.internal === "otf")!;
  const source = `<svg xmlns="http://www.w3.org/2000/svg"><defs>
    <font id="fixture" horiz-adv-x="600"><font-face font-family="Fixture" units-per-em="1000" ascent="800" descent="-200"/>
    <glyph unicode="A" glyph-name="A" horiz-adv-x="600" d="M10 20 l30 40 q50 60 70 80 c10 20 30 40 50 60 z"/>
    </font></defs></svg>`;
  const [encoded] = await handler.doConvert(
    [{ name: "fixture.svg", bytes: new TextEncoder().encode(source) }], svg, otf,
  );
  const font = parseFont(encoded.bytes.buffer as ArrayBuffer);
  expect(font.unitsPerEm).toBe(1000);
  expect(font.charToGlyph("A").advanceWidth).toBe(600);
  expect(font.charToGlyph("A").path.commands.map((command) => command.type)).toEqual(["M", "L", "C", "C", "Z"]);
});

test("updated Three SVG loading retains turtle stroke/fill output and restores the parser", () => {
  const originalParser = globalThis.DOMParser;
  const python = pyTurtleHandler.convert_program(`<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0 L20 20 L40 0 Z" fill="#ff0000" stroke="#0000ff" stroke-width="3"/>
    </svg>`);
  expect(python).toContain('t.fillcolor("#ff0000")');
  expect(python).toContain('t.pencolor("#0000ff")');
  expect(python).toContain("t.pensize(3)");
  expect(python).toContain("t.goto(");
  expect(globalThis.DOMParser).toBe(originalParser);
});

test("Preact 11 preserves file icon dimensions and the loaded SVG", async () => {
  GlobalRegistrator.register();
  const originalFetch = globalThis.fetch;
  const { h, render } = await import("preact");
  const { act } = await import("preact/test-utils");
  const { default: FileIcon } = await import("../src/ui/components/FileIcon/index.tsx");
  const container = document.createElement("div");
  document.body.append(container);
  globalThis.fetch = (async () => Response.json({
    extensions: { txt: "document" }, icons: { document: '<svg viewBox="0 0 16 16"><path d="M0 0h16v16z"/></svg>' },
  })) as typeof fetch;
  try {
    await act(async () => { render(h(FileIcon, { extension: "txt", size: 28 }), container); });
    // Fetch completion follows the first passive-effect flush.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const icon = container.querySelector<HTMLElement>(".file-icon")!;
    expect(icon.style.width).toBe("28px");
    expect(icon.style.height).toBe("28px");
    expect(icon.querySelector("svg path")).not.toBeNull();
  } finally {
    await act(() => { render(null, container); });
    globalThis.fetch = originalFetch;
    await GlobalRegistrator.unregister();
  }
});
