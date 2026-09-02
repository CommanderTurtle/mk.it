import mime from "mime";

import type { FileFormat } from "src/FormatHandler";
import type { ConversionOption, ConversionOptionsMap } from "src/main";
import normalizeMimeType from "src/normalizeMimeType";

export interface InputFormatChoice {
	key: string;
	label: string;
	option: ConversionOption;
}

function expandVideoContainerMimes(candidates: string[]): string[] {
	const output = new Set(candidates);
	for (const candidate of candidates) {
		if (candidate === "video/mp4" || candidate === "video/quicktime") {
			output.add("video/mp4");
			output.add("video/quicktime");
		}
	}
	return [...output];
}

export function getMimeCandidatesForFile(file: File): string[] {
	const candidates = new Set<string>();
	const raw = file.type?.trim();
	if (raw) candidates.add(normalizeMimeType(raw));
	const fromPath = mime.getType(file.name);
	if (fromPath) candidates.add(normalizeMimeType(fromPath));
	const extension = file.name.split(".").pop()?.toLowerCase();
	if (extension) {
		const fromExtension = mime.getType(extension);
		if (fromExtension) candidates.add(normalizeMimeType(fromExtension));
	}
	return expandVideoContainerMimes([...candidates]);
}

export function formatMatchesFile(format: FileFormat, extension: string, mimeCandidates: string[]): boolean {
	if (mimeCandidates.some(candidate => candidate === format.mime)) return true;
	if (!extension) return false;
	const normalizedExtension = extension.toLowerCase();
	return [format.extension, format.format, format.internal]
		.map(value => value.toLowerCase())
		.some(value => value === normalizedExtension || value.includes(normalizedExtension));
}

export function findMatchingFromFormats(options: ConversionOptionsMap, files: File[]): ConversionOptionsMap {
	if (files.length === 0) return options;
	const file = files[0];
	const mimeCandidates = getMimeCandidatesForFile(file);
	const extension = file.name.split(".").pop()?.toLowerCase() || "";
	const matching: ConversionOptionsMap = new Map();

	for (const [format, handler] of options) {
		if (format.from && formatMatchesFile(format, extension, mimeCandidates)) {
			matching.set(format, handler);
		}
	}
	return matching;
}

export function getMatchingFromFormats(options: ConversionOptionsMap, files: File[]): ConversionOptionsMap {
	const matching = findMatchingFromFormats(options, files);
	return matching.size ? matching : options;
}

export function getInputFormatChoices(options: ConversionOptionsMap): InputFormatChoice[] {
	const choices: InputFormatChoice[] = [];
	const seen = new Set<string>();
	for (const option of options) {
		const [format] = option;
		if (!format.from) continue;
		const key = `${format.extension.toLowerCase()}|${format.mime}|${format.format}`;
		if (seen.has(key)) continue;
		seen.add(key);
		choices.push({
			key,
			label: `.${format.extension} — ${format.name}`,
			option
		});
	}
	return choices.sort((left, right) => left.label.localeCompare(right.label));
}

export function findPngOutput(options: ConversionOptionsMap): ConversionOption | undefined {
	const png = [...options].filter(([format]) => format.to && format.mime === "image/png");
	return png.find(([, handler]) => handler.name === "ImageMagick") || png[0];
}
