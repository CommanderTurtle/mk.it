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
	const [isDisabled, setIsDisabled] = useState(disabled);
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
		setIsDisabled(true);
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
				<p><b>Truly universal online file converter.</b></p>
				<p>Many online file conversion tools are <b>boring</b> and <b>insecure</b>. They only allow conversion between two formats in the same medium (images to images, videos to videos, etc.), and they require that you <i>upload your files to some server</i>.</p>
				<p>This is not just terrible for privacy, it's also incredibly lame. What if you <i>really</i> need to convert an AVI video to a PDF document? Try to find an online tool for that, I dare you.</p>
				<p>Convert.to.it aims to be a tool that "just works". You're almost <i>guaranteed</i> to get an output - perhaps not always the one you expected, but it'll try its best to not leave you hanging.</p>
				<h2>Usage</h2>
				<ol>
					<li>Upload your file using the file browser, or drag and drop your file.</li>
					<li>Select an output format.</li>
					<li>Click <b>Convert!</b></li>
					<li>Hopefully, after a bit (or a lot) of thinking, the program will spit out the file you wanted.</li>
				</ol>
				<h2>Advanced mode</h2>
				<p>Advanced mode exposes additional conversion methods for some file types. If you do not intend on using a specific conversion method, it's better to leave it in Simple mode.</p>
			</>
		)
		popupOpen.value = true;
	}

	return (
		<div class={ `upload-field ${isDisabled ? 'upload-field-disabled' : null}` }>
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
					<button className="upload-card-dropzone-button" tabindex={ 1 }>Click to add your file</button>
					<span className="upload-card-dropzone-subtext">or drag and drop here</span>
				</div>

				<div className="upload-card-buttons">
					<button
						className="button"
						onClick={ onAdvancedModeClick }
						tabIndex={ 3 }
					>
						{ advancedModeText }
					</button>
					<button
						className="button"
						onClick={ onHelpClick }
						tabIndex={ 2 }
					>Help</button>
				</div>

			</div>
		</div>
	)
}
