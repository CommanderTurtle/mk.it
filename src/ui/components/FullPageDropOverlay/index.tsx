import { useEffect, useRef, useState } from "preact/hooks";
import { Upload } from "lucide-preact";

import { ConversionInProgress, CurrentPage, LoadingToolsText, Pages } from "src/ui/AppState";
import { SelectedFiles } from "src/main.new";

import "./index.css";

function getSingleDraggedFile(dataTransfer: DataTransfer | null): File | null {
	if (!dataTransfer) return null;

	if (dataTransfer.items && dataTransfer.items.length > 0) {
		const fileItems = Array.from(dataTransfer.items).filter((item) => item.kind === "file");
		if (fileItems.length !== 1) return null;

		const entry = fileItems[0].webkitGetAsEntry();
		if (entry?.isDirectory) return null;

		return fileItems[0].getAsFile();
	}

	if (dataTransfer.files.length !== 1) return null;
	return dataTransfer.files[0];
}

function getDragPreviewState(dataTransfer: DataTransfer | null): { valid: boolean; name: string | null } {
	if (!dataTransfer) return { valid: false, name: null };

	if (dataTransfer.items && dataTransfer.items.length > 0) {
		const fileItems = Array.from(dataTransfer.items).filter((item) => item.kind === "file");
		if (fileItems.length !== 1) return { valid: false, name: null };
		const entry = fileItems[0].webkitGetAsEntry();
		if (entry?.isDirectory) return { valid: false, name: null };
		const previewName = fileItems[0].getAsFile()?.name || fileItems[0].type || null;
		return { valid: true, name: previewName };
	}

	if (dataTransfer.files.length === 1) {
		return { valid: true, name: dataTransfer.files[0]?.name ?? null };
	}

	if (dataTransfer.files.length > 1) return { valid: false, name: null };
	return { valid: true, name: null };
}

export default function FullPageDropOverlay() {
	const [isDragging, setIsDragging] = useState(false);
	const [draggedFileName, setDraggedFileName] = useState<string | null>(null);
	const dragCounter = useRef(0);

	const formatsReady = LoadingToolsText.value === undefined;
	const canAcceptDrop = formatsReady && !ConversionInProgress.value;

	useEffect(() => {
		const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

		const handleDragEnter = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();

			dragCounter.current += 1;
			if (!canAcceptDrop) return;

			const preview = getDragPreviewState(event.dataTransfer);
			if (!preview.valid) return;
			setDraggedFileName(preview.name);
			setIsDragging(true);
		};

		const handleDragOver = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();
			if (!canAcceptDrop) return;
			const preview = getDragPreviewState(event.dataTransfer);
			if (!preview.valid) {
				setIsDragging(false);
				setDraggedFileName(null);
				return;
			}
			setDraggedFileName(preview.name);
			setIsDragging(true);
		};

		const handleDragLeave = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();

			dragCounter.current = Math.max(0, dragCounter.current - 1);
			if (dragCounter.current > 0) return;

			setIsDragging(false);
			setDraggedFileName(null);
		};

		const handleDrop = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();

			dragCounter.current = 0;
			setIsDragging(false);

			if (!canAcceptDrop) {
				setDraggedFileName(null);
				return;
			}

			const file = getSingleDraggedFile(event.dataTransfer);

			if (!file) {
				setDraggedFileName(null);
				return;
			}

			SelectedFiles.value = {
				[`${file.name}-${file.lastModified}`]: file
			};
			CurrentPage.value = Pages.Conversion;
			setDraggedFileName(null);
		};

		window.addEventListener("dragenter", handleDragEnter);
		window.addEventListener("dragover", handleDragOver);
		window.addEventListener("dragleave", handleDragLeave);
		window.addEventListener("drop", handleDrop);

		return () => {
			window.removeEventListener("dragenter", handleDragEnter);
			window.removeEventListener("dragover", handleDragOver);
			window.removeEventListener("dragleave", handleDragLeave);
			window.removeEventListener("drop", handleDrop);
		};
	}, [canAcceptDrop]);

	if (!isDragging || !canAcceptDrop) return null;

	return (
		<div className="full-page-drop-overlay" aria-hidden="true">
			<div className="full-page-drop-overlay-card">
				<div className="full-page-drop-overlay-icon">
					<Upload />
				</div>
				<p className="full-page-drop-overlay-title">Drop to upload</p>
				<p className="full-page-drop-overlay-subtitle">
					Release to convert your file
				</p>
				{draggedFileName && (
					<div className="full-page-drop-overlay-chip" role="status">
						<Upload size={14} />
						<span>{draggedFileName}</span>
					</div>
				)}
			</div>
		</div>
	);
}
