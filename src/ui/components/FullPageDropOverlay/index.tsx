import { useEffect, useRef, useState } from "preact/hooks";
import { Upload } from "lucide-preact";

import { CurrentPage, LoadingToolsText, Pages } from "src/ui/AppState";
import { SelectedFiles } from "src/main.new";

import "./index.css";

function getDraggedFileName(dataTransfer: DataTransfer | null): string | null {
	if (!dataTransfer) return null;

	for (const item of dataTransfer.items) {
		if (item.kind !== "file") continue;
		const file = item.getAsFile();
		if (file?.name) return file.name;
	}

	return dataTransfer.files[0]?.name ?? null;
}

export default function FullPageDropOverlay() {
	const [isDragging, setIsDragging] = useState(false);
	const [draggedFileName, setDraggedFileName] = useState<string | null>(null);
	const dragCounter = useRef(0);

	const formatsReady = LoadingToolsText.value === undefined;

	useEffect(() => {
		const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

		const handleDragEnter = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();

			dragCounter.current += 1;
			if (!formatsReady) return;

			setDraggedFileName(getDraggedFileName(event.dataTransfer));
			setIsDragging(true);
		};

		const handleDragOver = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();
			if (!formatsReady) return;
			setDraggedFileName(getDraggedFileName(event.dataTransfer));
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

			if (!formatsReady) {
				setDraggedFileName(null);
				return;
			}

			const file = event.dataTransfer?.files[0];
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
	}, [formatsReady]);

	if (!isDragging || !formatsReady) return null;

	return (
		<div className="full-page-drop-overlay" aria-hidden="true">
			<div className="full-page-drop-overlay-card">
				<div className="full-page-drop-overlay-icon">
					<Upload size={32} />
				</div>
				<p className="full-page-drop-overlay-title">Upload file</p>
				<p className="full-page-drop-overlay-subtitle">
					Drop file here to convert this file (will replace the current file)
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
