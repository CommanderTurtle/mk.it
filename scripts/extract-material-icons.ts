import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import { extraExtensionToIcon } from "./extra-language-extensions";
import upstreamPin from "../upstream-pin.json";

const REPO_URL = upstreamPin.materialIcons.repository;
const REPO_REVISION = upstreamPin.materialIcons.revision;
const CACHE_DIR = join(process.cwd(), ".cache/material-icon-theme");
const ICONS_SRC = join(CACHE_DIR, "icons");
const FILE_ICONS_TS = join(CACHE_DIR, "src/core/icons/fileIcons.ts");
const OUT_BUNDLE = join(process.cwd(), "public/icons.json");

const FILE_SVG_PATH =
  "m8.668 6h3.6641l-3.6641-3.668v3.668m-4.668-4.668h5.332l4 4v8c0 0.73828-0.59375 1.3359-1.332 1.3359h-8c-0.73828 0-1.332-0.59766-1.332-1.3359v-10.664c0-0.74219 0.59375-1.3359 1.332-1.3359m3.332 1.3359h-3.332v10.664h8v-6h-4.668z";
const DEFAULT_FILE_COLOR = "#90a4ae";

interface FileIconEntry {
  name: string;
  fileExtensions: string[];
  cloneBase?: string;
}

function ensureRepo(): void {
  if (!existsSync(join(CACHE_DIR, ".git"))) {
    mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
    const cloned = spawnSync("git", ["clone", "--depth", "1", REPO_URL, CACHE_DIR], {
      stdio: "inherit",
      encoding: "utf-8",
    });
    if (cloned.status !== 0) throw new Error("[material-icons] git clone failed");
  }

  const current = spawnSync("git", ["-C", CACHE_DIR, "rev-parse", "HEAD"], { encoding: "utf-8" });
  if (current.status === 0 && current.stdout.trim() === REPO_REVISION) return;

  const fetched = spawnSync("git", ["-C", CACHE_DIR, "fetch", "--depth", "1", REPO_URL, REPO_REVISION], {
    stdio: "inherit",
    encoding: "utf-8",
  });
  if (fetched.status !== 0) throw new Error(`[material-icons] could not fetch pinned revision ${REPO_REVISION}`);
  const selected = spawnSync("git", ["-C", CACHE_DIR, "checkout", "--detach", REPO_REVISION], {
    stdio: "inherit",
    encoding: "utf-8",
  });
  if (selected.status !== 0) throw new Error(`[material-icons] could not select pinned revision ${REPO_REVISION}`);
}

function extractFileIconEntries(sourcePath: string): FileIconEntry[] {
  const source = readFileSync(sourcePath, "utf-8");
  // TypeScript 7 supplies the compiler CLI, not the old compiler AST API.
  const parsed = parseSync(sourcePath, source);
  if (parsed.errors.length) throw new Error(`[material-icons] could not parse ${sourcePath}`);
  const out: FileIconEntry[] = [];

  const visitor = new Visitor({
    CallExpression(node) {
      const callee = node.callee;
      if (callee.type !== "Identifier" || callee.name !== "parseByPattern") return;
      const arg = node.arguments[0];
      if (arg?.type !== "ArrayExpression") return;
      for (const el of arg.elements) {
        if (el?.type !== "ObjectExpression") continue;
        let name: string | undefined;
        const fileExtensions: string[] = [];
        let cloneBase: string | undefined;
        for (const prop of el.properties) {
          if (prop.type !== "Property" || prop.computed) continue;
          const key = prop.key.type === "Identifier" ? prop.key.name
            : prop.key.type === "Literal" ? prop.key.value : "";
          const value = prop.value;
          if (key === "name" && value.type === "Literal" && typeof value.value === "string") {
            name = value.value;
          }
          if (key === "fileExtensions" && value.type === "ArrayExpression") {
            for (const extension of value.elements) {
              if (extension?.type === "Literal" && typeof extension.value === "string") {
                fileExtensions.push(extension.value);
              }
            }
          }
          if (key === "clone" && value.type === "ObjectExpression") {
            for (const clone of value.properties) {
              if (clone.type !== "Property" || clone.computed) continue;
              const cloneKey = clone.key.type === "Identifier" ? clone.key.name
                : clone.key.type === "Literal" ? clone.key.value : "";
              if (cloneKey === "base" && clone.value.type === "Literal"
                && typeof clone.value.value === "string") {
                cloneBase = clone.value.value;
              }
            }
          }
        }
        if (name && fileExtensions.length > 0) out.push({ name, fileExtensions, cloneBase });
      }
    },
  });
  visitor.visit(parsed.program);
  return out;
}

function resolveSourceIconPath(iconName: string, cloneBase: string | undefined): string | null {
  const candidates = [
    `${iconName}.svg`,
    `${iconName}.clone.svg`,
    ...(cloneBase ? [`${cloneBase}.svg`, `${cloneBase}.clone.svg`] : []),
    "document.svg",
  ];
  for (const c of candidates) {
    const p = join(ICONS_SRC, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function main(): void {
  ensureRepo();
  if (!existsSync(FILE_ICONS_TS)) {
    throw new Error("[material-icons] missing fileIcons.ts after clone");
  }

  const entries = extractFileIconEntries(FILE_ICONS_TS);
  const extToLogical = new Map<string, string>();

  for (const e of entries) {
    for (const ext of e.fileExtensions) {
      extToLogical.set(ext.toLowerCase(), e.name);
    }
  }

  for (const [ext, logical] of Object.entries(extraExtensionToIcon)) {
    if (!extToLogical.has(ext)) {
      extToLogical.set(ext, logical);
    }
  }

  const logicalNames = new Set(extToLogical.values());
  logicalNames.add("file");

  const documentFallback = join(ICONS_SRC, "document.svg");

  const icons: Record<string, string> = {};
  function materializeIcon(logical: string): void {
    if (logical === "file") {
      icons.file = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="${FILE_SVG_PATH}" fill="${DEFAULT_FILE_COLOR}" /></svg>`;
      return;
    }
    const entry = entries.find((x) => x.name === logical);
    const src = resolveSourceIconPath(logical, entry?.cloneBase);
    if (src) {
      icons[logical] = readFileSync(src, "utf-8");
    } else if (existsSync(documentFallback)) {
      icons[logical] = readFileSync(documentFallback, "utf-8");
    }
  }

  for (const logical of logicalNames) {
    materializeIcon(logical);
  }

  const extensionMap: Record<string, string> = {};
  for (const [ext, logical] of extToLogical.entries()) {
    extensionMap[ext] = logical;
  }

  mkdirSync(dirname(OUT_BUNDLE), { recursive: true });
  writeFileSync(OUT_BUNDLE, JSON.stringify({ extensions: extensionMap, icons }), "utf-8");

  console.log(
    `[material-icons] wrote ${Object.keys(extensionMap).length} extension mappings and ${logicalNames.size} icons to ${OUT_BUNDLE}`,
  );
}

main();
