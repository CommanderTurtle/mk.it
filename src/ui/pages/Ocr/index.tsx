import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Check, Clipboard, FileImage, LoaderCircle, Play, RotateCcw, ScanText } from "lucide-preact";
import type { Block, LoggerMessage, Worker } from "tesseract.js";

import { ConversionOptions } from "src/main";
import { findMatchingFromFormats, findPngOutput } from "src/tools/fileFormats";
import { buildOcrViewerDocument, flattenOcrWords, readImageDimensions } from "src/tools/ocr";
import { LoadingToolsText } from "src/ui/AppState";
import StyledButton, { ButtonVariant } from "src/ui/components/StyledButton";
import ToolShell from "src/ui/components/ToolShell";

import "./index.css";

interface PreparedImage {
	file: File;
	width: number;
	height: number;
}

async function prepareImage(file: File): Promise<PreparedImage> {
	try {
		return { file, ...await readImageDimensions(file) };
	} catch {
		if (LoadingToolsText.value !== undefined) {
			throw new Error("This image needs the converter to decode it, but conversion formats are still loading.");
		}

		const matching = findMatchingFromFormats(ConversionOptions, [file]);
		const pngOutput = findPngOutput(ConversionOptions);
		if (!matching.size || !pngOutput) {
			throw new Error("No installed conversion route can normalize this image for OCR.");
		}

		const orderedInputs = [...matching].sort((left, right) => {
			const leftSameHandler = left[1] === pngOutput[1] ? 1 : 0;
			const rightSameHandler = right[1] === pngOutput[1] ? 1 : 0;
			return rightSameHandler - leftSameHandler;
		});
		const sourceBytes = new Uint8Array(await file.arrayBuffer());
		for (const [format, handler] of orderedInputs) {
			const converted = await window.tryConvertByTraversing(
				[{ name: file.name, bytes: sourceBytes }],
				{ handler, format },
				{ handler: pngOutput[1], format: pngOutput[0] }
			);
			if (!converted?.files[0]) continue;
			const normalized = new File(
				[converted.files[0].bytes as BlobPart],
				converted.files[0].name,
				{ type: "image/png" }
			);
			try {
				return { file: normalized, ...await readImageDimensions(normalized) };
			} catch {
				// Try the next exact input format when an ambiguous extension matched.
			}
		}
		throw new Error("The image conversion completed without a browser-readable OCR input.");
	}
}

export default function OcrPage() {
	const inputRef = useRef<HTMLInputElement>(null);
	const workerRef = useRef<Worker | null>(null);
	const objectUrlRef = useRef<string | null>(null);
	const [sourceFile, setSourceFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [viewerDocument, setViewerDocument] = useState<string | null>(null);
	const [recognizedText, setRecognizedText] = useState("");
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const acceptedImageTypes = useMemo(() => {
		if (LoadingToolsText.value !== undefined) return "image/*";
		const extensions = [...ConversionOptions]
			.filter(([format]) => format.from && (
				format.mime.startsWith("image/")
				|| (Array.isArray(format.category) ? format.category.includes("image") : format.category === "image")
			))
			.map(([format]) => `.${format.extension.toLowerCase()}`);
		return ["image/*", ...new Set(extensions)].join(",");
	}, [LoadingToolsText.value]);

	const replacePreviewUrl = (file: File | null): string | null => {
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		objectUrlRef.current = file ? URL.createObjectURL(file) : null;
		setPreviewUrl(objectUrlRef.current);
		return objectUrlRef.current;
	};

	const chooseFile = (file: File | undefined) => {
		if (!file) return;
		setSourceFile(file);
		replacePreviewUrl(file);
		setViewerDocument(null);
		setRecognizedText("");
		setError(null);
		setStatus("");
		setProgress(0);
	};

	const reset = () => {
		setSourceFile(null);
		replacePreviewUrl(null);
		setViewerDocument(null);
		setRecognizedText("");
		setError(null);
		setStatus("");
		setProgress(0);
		if (inputRef.current) inputRef.current.value = "";
	};

	const runOcr = async () => {
		if (!sourceFile || busy) return;
		setBusy(true);
		setError(null);
		setViewerDocument(null);
		setRecognizedText("");
		setStatus("Preparing image");
		setProgress(0);
		try {
			const prepared = await prepareImage(sourceFile);
			const url = replacePreviewUrl(prepared.file);
			if (!url) throw new Error("Could not create the local image preview.");

			if (!workerRef.current) {
				setStatus("Loading English recognition data");
				const { createWorker } = await import("tesseract.js");
				workerRef.current = await createWorker("eng", undefined, {
					workerPath: `${import.meta.env.BASE_URL}js/tesseract/worker.min.js`,
					corePath: `${import.meta.env.BASE_URL}js/tesseract-core`,
					langPath: `${import.meta.env.BASE_URL}tesseract-lang`,
					logger: (message: LoggerMessage) => {
						setStatus(message.status);
						setProgress(Number.isFinite(message.progress) ? message.progress : 0);
					}
				});
			}

			setStatus("Recognizing text");
			const recognition = await workerRef.current.recognize(
				prepared.file,
				{},
				{ text: true, blocks: true, hocr: true }
			);
			const words = flattenOcrWords(recognition.data.blocks as Block[] | null);
			setRecognizedText(recognition.data.text);
			setViewerDocument(buildOcrViewerDocument(url, prepared.width, prepared.height, words));
			setStatus(`Recognized ${words.length.toLocaleString()} words at ${Math.round(recognition.data.confidence)}% confidence`);
			setProgress(1);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			setStatus("");
		} finally {
			setBusy(false);
		}
	};

	const copyText = async () => {
		try {
			await navigator.clipboard.writeText(recognizedText);
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		} catch {
			setError("Clipboard permission was denied. Select the extracted text and copy it manually.");
		}
	};

	useEffect(() => () => {
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		if (workerRef.current) void workerRef.current.terminate();
	}, []);

	return (
		<ToolShell
			title="Image OCR"
			description="Tesseract and its pinned English recognition data run locally in WebAssembly. No image, OCR text, worker, core, or language asset is fetched from a third-party service."
		>
			<section className="tool-surface ocr-surface">
				{!sourceFile ? (
					<div
						className="tool-upload-zone ocr-upload"
						role="button"
						tabIndex={0}
						onClick={() => inputRef.current?.click()}
						onKeyDown={event => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								inputRef.current?.click();
							}
						}}
						onDragOver={event => event.preventDefault()}
						onDrop={event => {
							event.preventDefault();
							chooseFile(event.dataTransfer?.files[0]);
						}}
					>
						<input
							ref={inputRef}
							type="file"
							accept={acceptedImageTypes}
							onChange={() => chooseFile(inputRef.current?.files?.[0])}
						/>
						<ScanText size={38} />
						<strong>Select an image</strong>
						<span>Common images open directly; other installed image formats are normalized through Convert to it.</span>
					</div>
				) : (
					<>
						<div className="ocr-toolbar">
							<div className="ocr-file"><FileImage size={18} /><strong>{sourceFile.name}</strong></div>
							<div className="ocr-actions">
								<StyledButton disabled={busy} onClick={reset}><RotateCcw size={14} /> New image</StyledButton>
								{recognizedText && <StyledButton onClick={copyText}>{copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "Copied" : "Copy text"}</StyledButton>}
								<StyledButton variant={ButtonVariant.Primary} disabled={busy} onClick={() => void runOcr()}>{busy ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />} {recognizedText ? "Run again" : "Run OCR"}</StyledButton>
							</div>
						</div>

						{(busy || status) && (
							<div className="ocr-progress" role="status">
								<span>{status}</span>
								<div><i style={{ width: `${Math.max(2, progress * 100)}%` }} /></div>
							</div>
						)}
						{error && <div className="ocr-error" role="alert">{error}</div>}

						{viewerDocument ? (
							<div className="ocr-results">
								<div className="ocr-result-panel">
									<h2>Selectable image text</h2>
									<iframe title="Image with selectable OCR text" srcDoc={viewerDocument} sandbox="allow-same-origin" />
								</div>
								<div className="ocr-result-panel">
									<h2>Extracted text</h2>
									<textarea value={recognizedText} readOnly spellcheck={false} />
								</div>
							</div>
						) : (
							<div className="ocr-source-preview">
								{previewUrl && <img src={previewUrl} alt="Selected OCR source" />}
							</div>
						)}
					</>
				)}
			</section>
		</ToolShell>
	);
}
