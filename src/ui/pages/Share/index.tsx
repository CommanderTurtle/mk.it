import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Check, Copy, Download, Expand, FileWarning, Link2, X } from "lucide-preact";

import { copyText } from "src/tools/clipboard";
import { downloadBytes } from "src/tools/download";
import { mediaEmbedHtml, previewKind, sharePayloadFromHash, shareUrl } from "src/tools/share";
import { sourcePreview } from "src/tools/sourcePreview";
import { ShareError, SharedFile } from "src/ui/AppState";
import StyledButton, { ButtonVariant } from "src/ui/components/StyledButton";
import ToolShell from "src/ui/components/ToolShell";

import "./index.css";

type CopyTarget = "link" | "source" | "html" | null;

function Media({ kind, url, name }: { kind: NonNullable<ReturnType<typeof previewKind>>; url: string; name: string }) {
	if (kind === "image") return <img src={url} alt={name} />;
	if (kind === "video") return <video src={url} controls preload="metadata" />;
	if (kind === "audio") return <audio src={url} controls preload="metadata" />;
	return <iframe src={url} title={name} />;
}

export default function SharePage() {
	const file = SharedFile.value;
	const error = ShareError.value;
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [objectUrl, setObjectUrl] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState<CopyTarget>(null);
	const [copyError, setCopyError] = useState("");
	const source = useMemo(() => file ? sourcePreview(file) : null, [file]);
	const kind = file ? previewKind(file.mime) : null;
	const link = useMemo(() => {
		if (!file) return "";
		return sharePayloadFromHash(location.hash) === null
			? shareUrl(file, new URL(import.meta.env.BASE_URL, location.origin).href)
			: location.href;
	}, [file]);

	useEffect(() => {
		if (!file) return;
		const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mime }));
		setObjectUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (expanded && !dialog.open) dialog.showModal();
		if (!expanded && dialog.open) dialog.close();
	}, [expanded]);

	useEffect(() => {
		if (!file) return;
		const previous = document.title;
		document.title = `${file.name} · mk.it`;
		return () => { document.title = previous; };
	}, [file]);

	const copy = async (target: Exclude<CopyTarget, null>, value: string) => {
		try {
			await copyText(value);
			setCopyError("");
			setCopied(target);
			setTimeout(() => setCopied(current => current === target ? null : current), 1400);
		} catch (caught) {
			setCopyError(caught instanceof Error ? caught.message : String(caught));
		}
	};

	if (!file) {
		return (
			<ToolShell title="Shared file" description="This URL carries the file locally in its fragment; mk.it never received or uploaded it.">
				<section className="tool-surface share-invalid" role="alert">
					<FileWarning size={28} />
					<h2>Could not open this file</h2>
					<p>{error || "The share payload is missing."}</p>
				</section>
			</ToolShell>
		);
	}

	const copyHtml = async () => {
		const html = mediaEmbedHtml(file);
		if (html) await copy("html", html);
	};

	return (
		<ToolShell
			title="Shared file"
			description="The complete file is compressed into this URL fragment and decoded only in the browser. Nothing is uploaded."
		>
			<section className="share-file-head">
				<div>
					<h2>{file.name}</h2>
					<p>{file.mime} · {file.bytes.length.toLocaleString()} bytes</p>
				</div>
				<div className="share-actions">
					<StyledButton onClick={() => copy("link", link)}>
						{copied === "link" ? <Check size={15} /> : <Link2 size={15} />}
						{copied === "link" ? "Copied" : "Copy share link"}
					</StyledButton>
					<StyledButton variant={ButtonVariant.Primary} onClick={() => downloadBytes(file.bytes, file.name, file.mime)}>
						<Download size={15} /> Download
					</StyledButton>
				</div>
			</section>
			{copyError && <p className="share-copy-error" role="alert">{copyError}</p>}

			<div className={`share-layout ${!kind || !source ? "share-layout--single" : ""}`}>
				{source && (
					<details className="tool-surface share-source" open={!kind}>
						<summary>
							<span>View source code</span>
							<small>{source.language}</small>
						</summary>
						<div className="share-code-toolbar">
							<span>{source.language}</span>
							<button type="button" onClick={event => {
								event.preventDefault();
								void copy("source", source.text);
							}}>
								{copied === "source" ? <Check size={13} /> : <Copy size={13} />}
								{copied === "source" ? "Copied" : "Copy"}
							</button>
						</div>
						<pre><code className="hljs" dangerouslySetInnerHTML={{ __html: source.html }} /></pre>
					</details>
				)}

				{kind && objectUrl && (
					<section className="tool-surface share-preview">
						<header>
							<div><strong>Preview</strong><small>{kind}</small></div>
							<div>
								<StyledButton title="Copy self-contained HTML" onClick={copyHtml}>
									{copied === "html" ? <Check size={14} /> : <Copy size={14} />}
									{copied === "html" ? "Copied" : "Copy HTML"}
								</StyledButton>
								<StyledButton title="Expand preview" onClick={() => setExpanded(true)}>
									<Expand size={14} /> Expand
								</StyledButton>
							</div>
						</header>
						<div className={`share-media share-media--${kind}`}><Media kind={kind} url={objectUrl} name={file.name} /></div>
					</section>
				)}

				{!kind && !source && (
					<section className="tool-surface share-binary">
						<FileWarning size={30} />
						<strong>Binary file</strong>
						<span>This format has no safe browser preview. Its exact bytes remain available to download.</span>
					</section>
				)}
			</div>

			{kind && objectUrl && (
				<dialog
					ref={dialogRef}
					className="share-preview-dialog"
					onClose={() => setExpanded(false)}
					onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}
				>
					<header><strong>{file.name}</strong><button type="button" onClick={() => setExpanded(false)} aria-label="Close preview"><X size={20} /></button></header>
					<div className={`share-media share-media--${kind}`}><Media kind={kind} url={objectUrl} name={file.name} /></div>
				</dialog>
			)}
		</ToolShell>
	);
}
