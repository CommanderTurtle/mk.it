import { useRef, useState } from 'preact/hooks';

import { CurrentPage, Pages, PopupData } from '../../index';
import { SelectedFiles, setSimpleMode, SimpleMode } from 'src/main.new';

import uploadImage from '../../img/fa-upload-solid-full.svg';
import logoImage from '../../img/logo.svg';

import DarkModeToggle from '../DarkModeToggle';
import { Icon } from "../Icon";

import './UploadField.css'
import { popupOpen } from 'src/ui/PopupStore';

interface UploadFieldComponentProps {
	disabled?: boolean
}

export default function UploadField({ disabled = false }: UploadFieldComponentProps) {
	const [isDragging, setIsDragging] = useState(false);
	const dragCounter = useRef<number>(0);

	const fileRef = useRef<HTMLInputElement>(null);

	const handleClick = (ev: MouseEvent) => {
		ev.preventDefault();
		fileRef.current?.click();
	}

	const handleDrop = (ev: DragEvent) => {
		ev.preventDefault();
		console.debug(ev.dataTransfer?.files);
	}

	const handleDragEnter = (ev: DragEvent) => {
		ev.preventDefault();
		dragCounter.current++;
		if (ev.dataTransfer?.types.includes('Files')) setIsDragging(true);
	}

	const handleDragLeave = (ev: DragEvent) => {
		ev.preventDefault();
		dragCounter.current--;
		if (dragCounter.current == 0) setIsDragging(false);
	}

	const handleDragOver = (ev: DragEvent) => {
		ev.preventDefault()

	}

	const handleChange = (_ev: preact.TargetedEvent<HTMLInputElement, Event>) => {
		const files = fileRef.current?.files;
		// check if files uploaded were empty
		if (
			!files
			|| files.length === 0
		) return

		SelectedFiles.push(...files);
		CurrentPage.value = Pages.Conversion;
	}

	const enum AdvancedModeTexts {
		SIMPLE = "Simple mode",
		ADVANCED = "Advanced mode"
	}
	const [advancedModeText, setAdvancedModeText] = useState<AdvancedModeTexts>(AdvancedModeTexts.ADVANCED);

	const onAdvancedModeClick = (ev: preact.TargetedMouseEvent<HTMLButtonElement>) => {
		setSimpleMode(!SimpleMode)
		setAdvancedModeText(SimpleMode ? AdvancedModeTexts.ADVANCED : AdvancedModeTexts.SIMPLE);
		if (SimpleMode) {
			document.documentElement.style.setProperty("--primary", "#1C77FF");
		} else document.documentElement.style.setProperty("--primary", "#FF6F1C");
	}

	const onHelpClick = (ev: preact.TargetedMouseEvent<HTMLButtonElement>) => {
		PopupData.value = {
			dismissible: true,
			buttonText: "OK"
		}
		PopupData.value.contents = (
			<>
				<h1>Help</h1>
				<p>Placeholder</p>
				{/* <h2>What's convert.to.it?</h2>
				<p>convert.to.it performs all of its processing in your browser using native conversion methods built into your browser, or through specialized conversion handlers that use modules and libraries, still on your device!</p>
				<p>No data ever leaves your device. It is 100% private</p>
				<h2>What makes convert.to.it different from other converters?</h2>
				<p>convert.to.it lets you convert <b>any file</b> to <b>any file</b>. Why convert <code>mp4</code> to <code>mp3</code> when you can turn it into a PowerPoint presentation? Or convert your <code>wav</code> music into a <code>png</code>?</p>
				<p>We don't limit what you can do. Try everything if you want!</p>
				<h2>Converting files</h2>
				<ol>
					<li>Drag and drop, or click/tap the upload area to upload a file of your choosing</li>
					<li>Choose your desired conversion target in the next page</li>
					<li>Click/tap the Convert button</li>
					<li>Wait for the conversion to finish</li>
					<li>Download your converted file</li>
				</ol>
				<h2>Advanced mode</h2>
				<p>Advanced mode exposes additional conversion methods for some file types. If you do not intend on using a specific conversion method, it's better to leave it in Simple mode</p> */}
			</>
		)
		popupOpen.value = true;
	}

	return (
		<div class="upload-field">
			<div className="upload-card">

				<div className="upload-card-header">
					<h1>
						<Icon
							src={ logoImage }
							size={ 60 }
							color="var(--primary)"
							className="upload-card-logo"
						/>
						<span className="upload-card-title">Convert to it!</span>
					</h1>
					<div className="upload-card-theme-toggle">
						<DarkModeToggle />
					</div>
				</div>

				<div
					className={ (isDragging ? "active-drag" : "").concat(" upload-card-dropzone-hint") }
					onClick={ handleClick }
					onDrop={ handleDrop }
					onDragOver={ handleDragOver }
					onDragEnter={ handleDragEnter }
					onDragLeave={ handleDragLeave }
					onChange={ handleChange }
				>
					<input
						ref={ fileRef }
						type="file"
						name="uploadFile"
						id="uploadFile"
						onClick={ (ev) => ev.stopPropagation() }
						tabIndex={ 0 }
					/>
					<div className="upload-card-dropzone-icon-container">
						<Icon src={ uploadImage } size={ 40 } color="var(--primary)" />
					</div>
					<button className="upload-card-dropzone-button">Click to add your file</button>
					<span className="upload-card-dropzone-subtext">or drag and drop here</span>
				</div>

				<div className="upload-card-buttons">
					<button
						className="button"
						onClick={ onAdvancedModeClick }
					>
						{ advancedModeText }
					</button>
					<button
						className="button"
						onClick={ onHelpClick }
					>Help</button>
				</div>

			</div>
		</div>
	)
}
