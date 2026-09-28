import type { CombinedArchive } from "./archiveCombine";
import type { SharedFileData } from "./share";

export function sharedArchiveFormat(file: SharedFileData): "zip" | "tar" | "7z" | null {
	const mime = file.mime.split(";", 1)[0].trim().toLowerCase();
	if (/\.zip$/i.test(file.name) || ["application/zip", "application/x-zip", "application/x-zip-compressed"].includes(mime)) return "zip";
	if (/\.tar$/i.test(file.name) || mime === "application/x-tar") return "tar";
	if (/\.7z$/i.test(file.name) || mime === "application/x-7z-compressed") return "7z";
	// Plain Base64 may have neither an archive filename nor a MIME declaration.
	// Do not mistake ZIP-based document formats (DOCX, ODT, etc.) for source archives.
	if ((!mime || mime === "application/octet-stream") && (!file.name.includes(".") || /\.bin$/i.test(file.name))) {
		const [a, b, c, d] = file.bytes;
		if (a === 0x50 && b === 0x4b && ((c === 3 && d === 4) || (c === 5 && d === 6))) return "zip";
		if ([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c].every((byte, index) => file.bytes[index] === byte)) return "7z";
	}
	return null;
}

export async function previewSharedArchive(file: SharedFileData): Promise<CombinedArchive | null> {
	const format = sharedArchiveFormat(file);
	if (!format) return null;
	const { combineArchive } = await import("./archiveCombine");
	// Preview a copy; names, bytes, checksums and share links remain those of the original.
	return combineArchive(new File([file.bytes as BlobPart], `preview.${format}`, {
		type: { zip: "application/zip", tar: "application/x-tar", "7z": "application/x-7z-compressed" }[format]
	}));
}
