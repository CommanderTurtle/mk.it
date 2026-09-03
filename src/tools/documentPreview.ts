import { marked } from "marked";

import type { SharedFileData } from "./share";
import { sourcePreview } from "./sourcePreview";

export type DocumentPreviewKind = "html" | "markdown";

export interface DocumentPreview {
	kind: DocumentPreviewKind;
	html: string;
}

function extensionOf(name: string): string {
	return name.split(/[?#]/, 1)[0].split(".").at(-1)?.toLowerCase() || "";
}

export function documentPreviewKind(file: Pick<SharedFileData, "name" | "mime">): DocumentPreviewKind | null {
	const extension = extensionOf(file.name);
	const mime = file.mime.split(";", 1)[0].trim().toLowerCase();
	if (["html", "htm", "xhtml"].includes(extension) || mime === "text/html" || mime === "application/xhtml+xml") return "html";
	if (["md", "markdown", "mdown", "mkdn"].includes(extension) || ["text/markdown", "text/x-markdown", "application/markdown"].includes(mime)) return "markdown";
	return null;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

export function buildMarkdownPreviewDocument(markdown: string, title = "Markdown preview"): string {
	const rendered = marked.parse(markdown, { async: false, gfm: true }) as string;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base target="_blank">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#fff;color:#1f2328}@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}a{color:#58a6ff}blockquote{color:#8b949e;border-color:#30363d}code,pre{background:#161b22!important}th,td{border-color:#30363d!important}}main{box-sizing:border-box;width:min(980px,100%);margin:auto;padding:clamp(1rem,4vw,3rem)}img,video,svg{max-width:100%;height:auto}audio{width:min(100%,640px)}pre{overflow:auto;padding:1rem;border-radius:8px;background:#f6f8fa}code{font:0.88em/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}pre code{font-size:.82rem;background:transparent}blockquote{margin-left:0;padding-left:1rem;border-left:4px solid #d0d7de;color:#59636e}table{display:block;max-width:100%;overflow:auto;border-spacing:0;border-collapse:collapse}th,td{padding:.45rem .75rem;border:1px solid #d0d7de}hr{height:1px;border:0;background:#d0d7de}details{margin:.75rem 0}a{overflow-wrap:anywhere}
</style>
</head>
<body><main>${rendered}</main></body>
</html>`;
}

export function documentPreview(file: SharedFileData, decodedText?: string): DocumentPreview | null {
	const kind = documentPreviewKind(file);
	if (!kind) return null;
	const text = decodedText ?? sourcePreview(file)?.text;
	if (text === undefined) return null;
	return {
		kind,
		html: kind === "html" ? text : buildMarkdownPreviewDocument(text, file.name)
	};
}
