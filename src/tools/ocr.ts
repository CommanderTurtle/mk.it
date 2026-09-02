export interface OcrBoundingBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface OcrWord {
	text: string;
	confidence: number;
	bbox: OcrBoundingBox;
}

interface TesseractWordLike {
	text: string;
	confidence: number;
	bbox: OcrBoundingBox;
}

interface TesseractBlockLike {
	paragraphs: Array<{
		lines: Array<{
			words: TesseractWordLike[];
		}>;
	}>;
}

export function flattenOcrWords(blocks: TesseractBlockLike[] | null | undefined): OcrWord[] {
	if (!blocks) return [];
	return blocks.flatMap(block => block.paragraphs.flatMap(
		paragraph => paragraph.lines.flatMap(line => line.words.map(word => ({
			text: word.text,
			confidence: word.confidence,
			bbox: word.bbox
		})))
	));
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

export function buildOcrViewerDocument(
	imageUrl: string,
	width: number,
	height: number,
	words: OcrWord[]
): string {
	const safeWidth = Math.max(1, width);
	const safeHeight = Math.max(1, height);
	const wordLayer = words.map(word => {
		const left = 100 * word.bbox.x0 / safeWidth;
		const top = 100 * word.bbox.y0 / safeHeight;
		const boxWidth = 100 * Math.max(1, word.bbox.x1 - word.bbox.x0) / safeWidth;
		const boxHeight = 100 * Math.max(1, word.bbox.y1 - word.bbox.y0) / safeHeight;
		return `<span class="word" title="Confidence ${Math.round(word.confidence)}%" style="left:${left}%;top:${top}%;width:${boxWidth}%;height:${boxHeight}%;font-size:clamp(7px,${Math.max(0.35, boxHeight)}vw,72px)">${escapeHtml(word.text)}</span>`;
	}).join("");

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;min-height:100%;background:#111;color:#fff;font-family:system-ui,sans-serif}
.stage{position:relative;width:100%;aspect-ratio:${safeWidth}/${safeHeight};overflow:hidden}
.stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none}
.word{position:absolute;display:block;overflow:hidden;color:transparent;line-height:1;white-space:nowrap;cursor:text;user-select:text;border-radius:2px}
.word:hover{background:rgba(35,131,226,.12);outline:1px solid rgba(35,131,226,.5)}
.word::selection{background:rgba(35,131,226,.55);color:transparent}
</style>
</head>
<body><div class="stage"><img src="${escapeHtml(imageUrl)}" alt="OCR source image"><div aria-label="Selectable OCR text layer">${wordLayer}</div></div></body>
</html>`;
}

export async function readImageDimensions(image: Blob): Promise<{ width: number; height: number }> {
	const url = URL.createObjectURL(image);
	try {
		const element = new Image();
		await new Promise<void>((resolve, reject) => {
			element.onload = () => resolve();
			element.onerror = () => reject(new Error("The browser could not decode this image directly."));
			element.src = url;
		});
		return { width: element.naturalWidth, height: element.naturalHeight };
	} finally {
		URL.revokeObjectURL(url);
	}
}
