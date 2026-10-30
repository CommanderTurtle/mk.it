export function downloadBytes(bytes: Uint8Array, name: string, _mime: string): void {
	// Downloads stay downloads even when the browser has a native media viewer (e.g. Opus).
	const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(text: string, name: string, mime = "text/plain;charset=utf-8"): void {
	downloadBytes(new TextEncoder().encode(text), name, mime);
}
