// Explicit maintenance import from a built ppocr-wasm dist; never run by the app.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.length !== 3) throw new Error("Usage: bun scripts/vendor-ppocr.mjs /path/to/ppocr-wasm/dist");
const source = resolve(process.argv[2]);
const destination = fileURLToPath(new URL("../public/ocr/paddle/", import.meta.url));
const build = JSON.parse(await readFile(resolve(source, "build.json"), "utf8"));
assert.equal(build.sdk, "@paddleocr/paddleocr-js@0.4.2");
assert.equal(build.ort, "onnxruntime-web@1.30.0");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const models = {
  "PP-OCRv6_small_det": "d218f6fbf0f1c23d2161bd6ac7f5eaa6104fa89955c09290497e31008e2618e4",
  "PP-OCRv6_small_rec": "d267ab077a44a0eedb1ea8f8c542d263f211de8e9d7a029bf9fcfff7e5a88fb1"
};
for (const [name, hash] of Object.entries(models)) {
  assert.equal(sha256(await readFile(resolve(source, "models", `${name}.tar`))), hash, name);
}

const files = ["ppocr.js", "ppocr.d.ts", "build.json", "models.json", "LICENSE", "README.md", "RESEARCH.md"];
async function collect(directory) {
  for (const entry of await readdir(resolve(source, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(relative);
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Not a regular vendored asset: ${relative}`);
  }
}
for (const directory of ["assets", "models", "runtime", "credits"]) await collect(directory);
const manifest = { source: "ppocr-wasm@0.1.0", ...build, files: {} };
for (const relative of files.sort()) {
  const target = resolve(destination, relative);
  assert.ok(target.startsWith(`${resolve(destination)}${sep}`));
  await mkdir(resolve(target, ".."), { recursive: true });
  await cp(resolve(source, relative), target);
  const bytes = await readFile(target);
  manifest.files[relative] = { bytes: bytes.length, sha256: sha256(bytes) };
}
await writeFile(resolve(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Vendored ${files.length} pinned Paddle assets (${Object.values(manifest.files).reduce((sum, file) => sum + file.bytes, 0)} bytes).`);
