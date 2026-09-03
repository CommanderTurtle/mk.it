import { useEffect, useRef, useState } from "preact/hooks";
import { Check, Clipboard, Download, Eye, FileArchive, FileText, LoaderCircle, RotateCcw } from "lucide-preact";

import { combineArchive, type CombinedArchive } from "src/tools/archiveCombine";
import { downloadText } from "src/tools/download";
import { PendingArchive } from "src/ui/AppState";
import StyledButton, { ButtonVariant } from "src/ui/components/StyledButton";
import ToolShell from "src/ui/components/ToolShell";

import "./index.css";

type PreviewMode = "pretty" | "raw";

export default function CombinePage() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [archiveName, setArchiveName] = useState("");
	const [result, setResult] = useState<CombinedArchive | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [previewMode, setPreviewMode] = useState<PreviewMode>("pretty");
	const [copied, setCopied] = useState(false);

	const processArchive = async (file: File | undefined) => {
		if (!file) return;
		setArchiveName(file.name);
		setResult(null);
		setError(null);
		setBusy(true);
		try {
			setResult(await combineArchive(file));
			setPreviewMode("pretty");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const copyRaw = async () => {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(result.markdown);
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		} catch {
			setError("Clipboard permission was denied. Use Render raw and copy the text manually.");
		}
	};

	const reset = () => {
		setArchiveName("");
		setResult(null);
		setError(null);
		setBusy(false);
		if (inputRef.current) inputRef.current.value = "";
	};

	useEffect(() => {
		const pending = PendingArchive.value;
		if (!pending) return;
		PendingArchive.value = null;
		void processArchive(pending);
	}, []);

	return (
		<ToolShell
			title="Archive to Markdown"
			description="Recursively combine source trees without extracting them. Text stays exact inside safe code fences; binaries and oversized entries retain their path with an explicit omitted marker."
		>
			<section className="tool-surface combine-surface">
				{!archiveName && (
					<div
						className="tool-upload-zone combine-upload"
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
							void processArchive(event.dataTransfer?.files[0]);
						}}
					>
						<input
							ref={inputRef}
							type="file"
							accept=".zip,.tar,application/zip,application/x-tar"
							onChange={() => void processArchive(inputRef.current?.files?.[0])}
						/>
						<FileArchive size={38} />
						<strong>Select a ZIP or TAR archive</strong>
						<span>ZIP and TAR stay entirely in this browser.</span>
					</div>
				)}

				{archiveName && (
					<>
						<div className="combine-toolbar">
							<div className="combine-file">
								<FileArchive size={18} />
								<div><strong>{archiveName}</strong>{result && <span>{result.included} included · {result.omitted} omitted</span>}</div>
							</div>
							<div className="combine-actions">
								<StyledButton onClick={reset}><RotateCcw size={14} /> New archive</StyledButton>
								{result && (
									<>
										<StyledButton onClick={copyRaw}>{copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "Copied" : "Copy raw"}</StyledButton>
										<StyledButton onClick={() => setPreviewMode("pretty")} variant={previewMode === "pretty" ? ButtonVariant.Primary : ButtonVariant.Default}><Eye size={14} /> Render pretty</StyledButton>
										<StyledButton onClick={() => setPreviewMode("raw")} variant={previewMode === "raw" ? ButtonVariant.Primary : ButtonVariant.Default}><FileText size={14} /> Render raw</StyledButton>
										<StyledButton onClick={() => downloadText(result.markdown, "combined.md", "text/markdown;charset=utf-8")}><Download size={14} /> Download</StyledButton>
									</>
								)}
							</div>
						</div>

						{busy && <div className="combine-state"><LoaderCircle className="spin" size={26} /><strong>Reading archive…</strong><span>Classifying entries and preserving source text.</span></div>}
						{error && <div className="combine-error" role="alert">{error}</div>}
						{result && previewMode === "raw" && <textarea className="combine-raw" value={result.markdown} readOnly spellcheck={false} aria-label="Combined Markdown" />}
						{result && previewMode === "pretty" && (
							<div className="combine-pretty">
								{result.entries.map((entry, index) => (
									<article key={`${entry.path}-${index}`}>
										<h2>File: ./{entry.path}</h2>
										{entry.omittedReason
											? <p className="omitted">(omitted — {entry.omittedReason})</p>
											: <pre><code>{entry.text}</code></pre>}
									</article>
								))}
							</div>
						)}
					</>
				)}
			</section>
		</ToolShell>
	);
}
