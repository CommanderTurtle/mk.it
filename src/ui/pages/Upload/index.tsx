import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ArrowRight, Check, Copy, Download, FileArchive, FileCode2, RotateCcw, ScanText, Share2, Upload } from "lucide-preact";

import { ConversionOptions, goToUploadHome, openSharedFile, SelectedFiles } from "src/main";
import { isSupportedArchive } from "src/tools/archiveCombine";
import { base64DataUrl, decodeBase64, encodeBase64, filenameForFormat, type DecodedBase64 } from "src/tools/base64";
import { copyText } from "src/tools/clipboard";
import { downloadBytes } from "src/tools/download";
import { getInputFormatChoices } from "src/tools/fileFormats";
import { fileMime } from "src/tools/share";
import { CurrentPage, LoadingToolsText, Pages, PendingArchive, PopupData } from "src/ui/AppState";
import Footer from "src/ui/components/Footer";
import HelpButton from "src/ui/components/HelpButton";
import Logo from "src/ui/components/Logo";
import ProjectLinks from "src/ui/components/ProjectLinks";
import StyledButton, { ButtonVariant } from "src/ui/components/StyledButton";
import { openPopup } from "src/ui/PopupStore";

import "./index.css";

export default function UploadPage() {
	const fileRef = useRef<HTMLInputElement>(null);
	const base64FileRef = useRef<HTMLInputElement>(null);
	const [base64Input, setBase64Input] = useState("");
	const [decoded, setDecoded] = useState<DecodedBase64 | null>(null);
	const [base64Error, setBase64Error] = useState<string | null>(null);
	const [base64Filename, setBase64Filename] = useState("decoded");
	const [base64FormatKey, setBase64FormatKey] = useState("");
	const [includeMime, setIncludeMime] = useState(true);
	const [encodedUpload, setEncodedUpload] = useState<{ file: File; bytes: Uint8Array } | null>(null);
	const [encodingFile, setEncodingFile] = useState(false);
	const [base64Copied, setBase64Copied] = useState(false);
	const formatsReady = LoadingToolsText.value === undefined;
	const formatChoices = useMemo(
		() => formatsReady ? getInputFormatChoices(ConversionOptions) : [],
		[formatsReady]
	);
	const selectedChoice = formatChoices.find(choice => choice.key === base64FormatKey);

	const choiceForFile = (file: Pick<File, "name" | "type">) => {
		const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
		const mime = fileMime(file);
		return formatChoices.find(choice => {
			const format = choice.option[0];
			return format.mime === mime || format.extension.toLowerCase() === extension;
		});
	};

	const encodedValue = (upload: { file: File; bytes: Uint8Array }, withMime: boolean) => withMime
		? base64DataUrl(upload.bytes, fileMime(upload.file))
		: encodeBase64(upload.bytes);

	const encodeFile = async (file: File | undefined) => {
		if (!file) return;
		setEncodingFile(true);
		setBase64Error(null);
		setDecoded(null);
		try {
			const upload = { file, bytes: new Uint8Array(await file.arrayBuffer()) };
			setEncodedUpload(upload);
			setBase64Input(encodedValue(upload, includeMime));
			setBase64Filename(file.name);
			setBase64FormatKey(choiceForFile(file)?.key || "");
		} catch (error) {
			setEncodedUpload(null);
			setBase64Error(error instanceof Error ? error.message : String(error));
		} finally {
			setEncodingFile(false);
		}
	};

	const setMimeMode = (withMime: boolean) => {
		setIncludeMime(withMime);
		if (encodedUpload) setBase64Input(encodedValue(encodedUpload, withMime));
	};

	const processFiles = (fileList: FileList | null | undefined) => {
		if (!fileList || fileList.length === 0 || !formatsReady) return;
		const files = Array.from(fileList);
		if (!files.every(file => file.type === files[0].type)) {
			PopupData.value = {
				title: "Invalid selection",
				text: "All input files must be of the same type.",
				dismissible: true,
				buttonText: "OK"
			};
			openPopup();
			return;
		}

		SelectedFiles.value = Object.fromEntries(files.map(
			file => [`${file.name}-${file.lastModified}`, file]
		));
		CurrentPage.value = Pages.Conversion;
	};

	const handleBase64Done = () => {
		try {
			const result = decodeBase64(base64Input);
			setDecoded(result);
			setBase64Error(null);
			const inferred = encodedUpload
				? choiceForFile(encodedUpload.file)
				: result.mime
				? formatChoices.find(choice => choice.option[0].mime === result.mime)
				: undefined;
			setBase64FormatKey(inferred?.key || base64FormatKey || formatChoices[0]?.key || "");
		} catch (error) {
			setDecoded(null);
			setBase64Error(error instanceof Error ? error.message : String(error));
		}
	};

	const resetBase64 = () => {
		setDecoded(null);
		setBase64Error(null);
		setBase64FormatKey("");
	};

	const makeBase64File = (): File | null => {
		if (!decoded || !selectedChoice) return null;
		const format = selectedChoice.option[0];
		return new File(
			[decoded.bytes as BlobPart],
			filenameForFormat(base64Filename, format.extension),
			{ type: format.mime }
		);
	};

	const downloadDecoded = () => {
		const file = makeBase64File();
		if (!file || !decoded) return;
		downloadBytes(decoded.bytes, file.name, file.type);
	};

	const convertDecoded = () => {
		const file = makeBase64File();
		if (!file) return;
		SelectedFiles.value = { [`${file.name}-${file.lastModified}`]: file };
		CurrentPage.value = Pages.Conversion;
	};

	const shareDecoded = () => {
		const file = makeBase64File();
		if (!file || !decoded) return;
		openSharedFile({ name: file.name, mime: file.type, bytes: decoded.bytes.slice() });
	};

	const archiveFile = (): File | null => {
		if (!decoded) return null;
		if (encodedUpload && isSupportedArchive(encodedUpload.file)) {
			return new File([decoded.bytes as BlobPart], encodedUpload.file.name, { type: fileMime(encodedUpload.file) });
		}
		const file = makeBase64File();
		return file && isSupportedArchive(file) ? file : null;
	};

	const combineDecoded = () => {
		const file = archiveFile();
		if (!file) return;
		PendingArchive.value = file;
		CurrentPage.value = Pages.Combine;
	};

	const copyEncoded = async () => {
		try {
			await copyText(base64Input);
			setBase64Copied(true);
			setTimeout(() => setBase64Copied(false), 1400);
		} catch (error) {
			setBase64Error(error instanceof Error ? error.message : String(error));
		}
	};

	useEffect(() => {
		const handlePaste = (event: ClipboardEvent) => processFiles(event.clipboardData?.files);
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [formatsReady]);

	return (
		<div className="upload-page">
			<main className="home-shell">
				<header className="home-header">
					<div>
						<Logo showName={true} size={36} onClick={goToUploadHome} />
						<p>Private, on-device conversion and document tools.</p>
					</div>
					<div className="project-header-actions"><ProjectLinks /><HelpButton /></div>
				</header>

				<section className="home-primary-grid" aria-label="Primary tools">
					<article className="home-tool-panel">
						<div className="home-tool-heading">
							<span className="home-tool-icon"><Upload size={20} /></span>
							<div>
								<h1>Convert a file</h1>
								<p>Use the original universal conversion graph.</p>
							</div>
						</div>

						<div
							className={`upload-dropzone ${!formatsReady ? "upload-dropzone--pending" : ""}`}
							onClick={() => formatsReady && fileRef.current?.click()}
							role="button"
							tabIndex={0}
							onKeyDown={event => {
								if ((event.key === "Enter" || event.key === " ") && formatsReady) {
									event.preventDefault();
									fileRef.current?.click();
								}
							}}
						>
							<input
								ref={fileRef}
								type="file"
								multiple
								disabled={!formatsReady}
								onChange={() => processFiles(fileRef.current?.files)}
								onClick={event => event.stopPropagation()}
							/>
							<Upload size={30} />
							<strong>{window.matchMedia("(pointer: coarse)").matches ? "Tap" : "Click"} to select</strong>
							<span>{window.matchMedia("(pointer: coarse)").matches ? "Choose one or more matching files" : "or drag and drop matching files"}</span>
						</div>
					</article>

					<article className="home-tool-panel base64-panel">
						<div className="home-tool-heading">
							<span className="home-tool-icon"><FileCode2 size={20} /></span>
							<div>
								<h2>Base64 file</h2>
								<p>Decode, name, download, or pass into the converter.</p>
							</div>
						</div>

						{!decoded ? (
							<>
								<input
									ref={base64FileRef}
									className="base64-file-picker"
									type="file"
									onClick={event => { event.currentTarget.value = ""; }}
									onChange={() => void encodeFile(base64FileRef.current?.files?.[0])}
								/>
								<textarea
									className={base64Error ? "field-error" : ""}
									value={base64Input}
									onInput={event => {
										setBase64Input(event.currentTarget.value);
										setEncodedUpload(null);
									}}
									placeholder="Paste raw base64 or a data:…;base64 URL"
									spellcheck={false}
									aria-label="Base64 payload"
								/>
								{base64Error && <p className="inline-error" role="alert">{base64Error}</p>}
								<div className="base64-entry-actions">
									<StyledButton disabled={encodingFile} onClick={() => base64FileRef.current?.click()}>
										<Upload size={14} /> {encodingFile ? "Encoding…" : "Encode file"}
									</StyledButton>
									<label className="base64-mime-toggle">
										<input type="checkbox" checked={includeMime} onChange={event => setMimeMode(event.currentTarget.checked)} />
										<span>Include MIME</span>
									</label>
									<span className="panel-actions-spacer" />
									<StyledButton disabled={!base64Input} title="Copy encoded text" onClick={() => void copyEncoded()}>
										{base64Copied ? <Check size={14} /> : <Copy size={14} />} {base64Copied ? "Copied" : "Copy"}
									</StyledButton>
									<StyledButton
										variant={ButtonVariant.Primary}
										disabled={!formatsReady || !base64Input.trim()}
										onClick={handleBase64Done}
									>
										Done <ArrowRight size={15} />
									</StyledButton>
								</div>
								{encodedUpload && (
									<p className="encoded-file-summary">
										{encodedUpload.file.name} · {encodedUpload.bytes.length.toLocaleString()} bytes · {includeMime ? fileMime(encodedUpload.file) : "raw Base64"}
									</p>
								)}
							</>
						) : (
							<div className="base64-details">
								<p className="decoded-summary">Decoded {decoded.bytes.length.toLocaleString()} bytes{decoded.mime ? ` as ${decoded.mime}` : ""}.</p>
								<label>
									<span>File name</span>
									<input value={base64Filename} onInput={event => setBase64Filename(event.currentTarget.value)} />
								</label>
								<label>
									<span>File type</span>
									<select value={base64FormatKey} onChange={event => setBase64FormatKey(event.currentTarget.value)}>
										{formatChoices.map(choice => <option value={choice.key} key={choice.key}>{choice.label}</option>)}
									</select>
								</label>
								<div className="panel-actions panel-actions--split">
									<StyledButton onClick={resetBase64}><RotateCcw size={14} /> Reset</StyledButton>
									<span className="panel-actions-spacer" />
									<StyledButton disabled={!selectedChoice} onClick={downloadDecoded}><Download size={14} /> Download</StyledButton>
									<StyledButton disabled={!selectedChoice} onClick={shareDecoded}><Share2 size={14} /> Share</StyledButton>
									{archiveFile() && <StyledButton onClick={combineDecoded}><FileArchive size={14} /> Combine</StyledButton>}
									<StyledButton variant={ButtonVariant.Primary} disabled={!selectedChoice} onClick={convertDecoded}>Convert <ArrowRight size={14} /></StyledButton>
								</div>
							</div>
						)}
					</article>
				</section>

				<section className="home-secondary-grid" aria-label="Document tools">
					<button className="home-route-card" onClick={() => CurrentPage.value = Pages.Ocr}>
						<span className="home-tool-icon"><ScanText size={21} /></span>
						<span className="route-copy"><strong>Image OCR</strong><small>Recognize text locally with Tesseract WebAssembly.</small></span>
						<ArrowRight size={18} />
					</button>
					<button className="home-route-card" onClick={() => CurrentPage.value = Pages.Combine}>
						<span className="home-tool-icon"><FileArchive size={21} /></span>
						<span className="route-copy"><strong>Archive to Markdown</strong><small>Combine ZIP or TAR source trees; mark binaries omitted.</small></span>
						<ArrowRight size={18} />
					</button>
				</section>
			</main>

			<Footer loadingText={LoadingToolsText.value} />
		</div>
	);
}
