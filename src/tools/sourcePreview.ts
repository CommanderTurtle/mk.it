import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

export interface SourcePreview {
	text: string;
	language: string;
	html: string;
}

const languages = {
	bash, c, cpp, csharp, css, go, ini, java, javascript, json, kotlin, markdown,
	php, plaintext, powershell, python, ruby, rust, sql, swift, typescript, xml, yaml
};
for (const [name, definition] of Object.entries(languages)) hljs.registerLanguage(name, definition);
hljs.registerAliases(["html", "svg"], { languageName: "xml" });
hljs.registerAliases(["js", "mjs", "cjs"], { languageName: "javascript" });
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["md", "mdx"], { languageName: "markdown" });
hljs.registerAliases(["sh", "zsh"], { languageName: "bash" });
hljs.registerAliases(["ps1"], { languageName: "powershell" });

const extensionLanguages: Record<string, string> = {
	bat: "bash", c: "c", cc: "cpp", conf: "ini", cpp: "cpp", cs: "csharp",
	css: "css", go: "go", h: "c", hpp: "cpp", htm: "xml", html: "xml",
	ini: "ini", java: "java", js: "javascript", json: "json", jsx: "javascript",
	kt: "kotlin", kts: "kotlin", markdown: "markdown", md: "markdown", mdx: "markdown",
	mjs: "javascript", php: "php", ps1: "powershell", py: "python", rb: "ruby",
	rc: "ini", rs: "rust", scss: "css", sh: "bash", sql: "sql", svg: "xml",
	swift: "swift", toml: "ini", ts: "typescript", tsx: "typescript", txt: "plaintext",
	xhtml: "xml", xml: "xml", yaml: "yaml", yml: "yaml", zsh: "bash"
};

const textualMime = /^(?:text\/|application\/(?:.*\+)?(?:json|xml|javascript|typescript|yaml|toml|x-sh|sql)$)/i;

function extensionOf(name: string): string {
	return name.split(/[?#]/, 1)[0].split(".").at(-1)?.toLowerCase() || "";
}

function decodeText(bytes: Uint8Array): string | null {
	try {
		if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
		if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
		const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		if (text.includes("\u0000")) return null;
		return text;
	} catch {
		return null;
	}
}

export function sourcePreview(file: { name: string; mime: string; bytes: Uint8Array }): SourcePreview | null {
	const extension = extensionOf(file.name);
	const declaredText = textualMime.test(file.mime) || extension in extensionLanguages || file.mime === "image/svg+xml";
	const bareMime = file.mime.split(";", 1)[0].toLowerCase();
	if (!declaredText && (/^(?:image|video|audio)\//.test(bareMime) || bareMime === "application/pdf")) {
		return null;
	}
	const text = decodeText(file.bytes);
	if (text === null || (!declaredText && /[\u0001-\u0008\u000e-\u001f]/.test(text))) return null;

	const language = extensionLanguages[extension]
		|| (/svg|xml/i.test(file.mime) ? "xml" : /json/i.test(file.mime) ? "json" : "plaintext");
	const result = language === "plaintext"
		? hljs.highlightAuto(text, Object.keys(languages).filter(name => name !== "plaintext"))
		: hljs.highlight(text, { language, ignoreIllegals: true });
	return { text, language: result.language || language, html: result.value };
}
