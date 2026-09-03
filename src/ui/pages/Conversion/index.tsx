import './index.css';

import { useState, useMemo, useCallback, useEffect } from "preact/hooks";
import { ConversionOptions, SelectedFiles, type ConversionOption, type ConversionOptionsMap } from 'src/main';
import { Mode, ModeEnum } from "src/ui/ModeStore";
import { getMatchingFromFormats } from "src/tools/fileFormats";
import { downloadBytes } from "src/tools/download";
import { copyText } from "src/tools/clipboard";
import { fileDataUrl } from "src/tools/share";

import ConversionHeader from "src/ui/components/Conversion/ConversionHeader";
import FormatExplorer from "src/ui/components/Conversion/FormatExplorer";
import LoadingScreen from "src/ui/components/LoadingScreen";
import Footer from "src/ui/components/Footer";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-preact";
import { PopupData } from "src/ui";
import { closePopup, openPopup } from "src/ui/PopupStore";
import FileInfoBadge from "src/ui/components/FileInfo";
import { ConversionInProgress, CurrentPage, Pages } from "src/ui/AppState";
import { ProgressStore } from "src/ui/ProgressStore";
import StyledButton, { ButtonVariant } from "src/ui/components/StyledButton";

type ConversionStep = "select-from" | "select-to" | "converting";

function countAvailableFormats(options: ConversionOptionsMap, direction: "from" | "to", advancedMode: boolean): number {
	const seen = new Set<string>();
	let count = 0;

	for (const [format] of options) {
		if (direction === "from" && !format.from) continue;
		if (direction === "to" && !format.to) continue;

		if (advancedMode) {
			count += 1;
			continue;
		}

		const dedupeKey = `${format.mime}|${format.format}`;
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);
		count += 1;
	}

	return count;
}

function getConversionOptions(): ConversionOptionsMap {
	if (ConversionOptions.size) return ConversionOptions;
	throw new Error("Can't build format list!", { cause: "UI got empty global format list" });
}

export default function Conversion() {
	const allOptions = getConversionOptions();
	const files = Object.values(SelectedFiles.value);
	const firstFile = files[0];
	const isAdvanced = Mode.value === ModeEnum.Advanced;

	const matchingFrom = useMemo(
		() => getMatchingFromFormats(allOptions, files),
		[allOptions, files]
	);

	const autoAdvance = useMemo(() => {
		if (!matchingFrom.size) return false;
		const isSimple = Mode.value === ModeEnum.Simple;
		if (!isSimple) return matchingFrom.size === 1;
		const uniqueFormats = new Set<string>();
		for (const [format] of matchingFrom) {
			uniqueFormats.add(`${format.mime}|${format.format}`);
		}
		return uniqueFormats.size === 1;
	}, [matchingFrom, Mode.value]);

	const [step, setStep] = useState<ConversionStep>(() => {
		if (autoAdvance) return "select-to";
		return "select-from";
	});

	const [fromOption, setFromOption] = useState<ConversionOption | null>(() => {
		if (autoAdvance) {
			const first = matchingFrom.entries().next().value;
			return first ? [first[0], first[1]] : null;
		}
		return null;
	});

	const [toOption, setToOption] = useState<ConversionOption | null>(null);
	const [isConverting, setIsConverting] = useState(false);
	const [base64Copied, setBase64Copied] = useState(false);

	useEffect(() => {
		if (!firstFile || isConverting) return;

		if (autoAdvance) {
			const first = matchingFrom.entries().next().value;
			setFromOption(first ? [first[0], first[1]] : null);
			setStep("select-to");
		} else {
			setFromOption(null);
			setStep("select-from");
		}

		setToOption(null);
		setBase64Copied(false);
	}, [firstFile]);

	const handleCopyBase64 = async () => {
		if (files.length !== 1 || !firstFile) return;
		try {
			await copyText(await fileDataUrl(firstFile));
			setBase64Copied(true);
			setTimeout(() => setBase64Copied(false), 1400);
		} catch (error) {
			PopupData.value = {
				title: "Clipboard unavailable",
				text: error instanceof Error ? error.message : String(error),
				dismissible: true,
				buttonText: "OK"
			};
			openPopup();
		}
	};

	const handleFromSelect = useCallback((option: ConversionOption | null) => {
		setFromOption(option);
		if (!option) setToOption(null);
	}, []);

	const handleToSelect = useCallback((option: ConversionOption | null) => {
		setToOption(option);
	}, []);

	const handleNext = () => {
		if (step === "select-from" && fromOption) {
			setStep("select-to");
			setToOption(null);
		}
	};

	const handleBack = () => {
		if (step === "select-to") {
			setStep("select-from");
			setToOption(null);
		}
	};

	const handleFromToClickFrom = () => {
		setStep("select-from");
		setFromOption(null);
		setToOption(null);
	};

	const handleFromToClickTo = () => {
		setStep("select-to");
		setToOption(null);
	};

	const removeFile = (key: string) => {
		const { [key as keyof typeof SelectedFiles.value]: _, ...rest } = SelectedFiles.value;
		SelectedFiles.value = rest;
		if (Object.keys(rest).length === 0) CurrentPage.value = Pages.Upload;
	};

	const handleConvert = async () => {
		if (!fromOption || !toOption || !firstFile) return;

		setIsConverting(true);
		ConversionInProgress.value = true;
		setStep("converting");
		ProgressStore.reset();
		const abortController = ProgressStore.controller;

		try {
			const inputFileData = [];
			for (const f of files) {
				const buf = await f.arrayBuffer();
				const bytes = new Uint8Array(buf);

				if (fromOption[0].mime === toOption[0].mime && fromOption[0].format === toOption[0].format) {
					downloadBytes(bytes, f.name, toOption[0].mime);
					continue;
				}
				inputFileData.push({ name: f.name, bytes });
			}

			if (inputFileData.length === 0) {
				setIsConverting(false);
				setStep("select-to");
				return;
			}

			const fromNode = { handler: fromOption[1], format: fromOption[0] };
			const toNode = { handler: toOption[1], format: toOption[0] };

			const output = await window.tryConvertByTraversing(inputFileData, fromNode, toNode, abortController.signal);

			if (!output) {
				setIsConverting(false);
				setStep("select-to");
				PopupData.value = {
					title: "Conversion failed",
					text: "Could not find a valid conversion route between these formats.",
					dismissible: true,
					buttonText: "OK",
				};
				openPopup();
				return;
			}

			for (const file of output.files) {
				downloadBytes(file.bytes, file.name, toOption[0].mime);
			}

			PopupData.value = {
				title: "Conversion complete!",
				text: `Converted ${fromOption[0].format.toUpperCase()} → ${toOption[0].format.toUpperCase()} via ${output.path.map(c => c.format.format).join(" → ")}`,
				dismissible: true,
				buttonText: "OK",
			};
			openPopup();
		} catch (e) {
			console.error(e);
			if (e instanceof DOMException && e.name === "AbortError") {
				// Don't show an error popup for manual cancellation
			} else {
				PopupData.value = {
					title: "Conversion error",
					text: `An unexpected error occurred: ${e}`,
					dismissible: true,
					buttonText: "OK",
				};
				openPopup();
			}
		} finally {
			setIsConverting(false);
			ConversionInProgress.value = false;
			setStep("select-to");
		}
	};

	const canProceed = step === "select-from" ? !!fromOption : !!toOption;

	return (
		<div className="conversion-body">
			<ConversionHeader logoDisabled={step === "converting"} />

			<main className="conversion-main">
				{step === "converting" ? (
					<LoadingScreen
						fileName={firstFile?.name || "file"}
						fileSize={firstFile?.size}
						from={fromOption?.[0]}
						to={toOption?.[0]}
					/>
				) : (
					<FormatExplorer
						conversionOptions={step === "select-from" ? matchingFrom : allOptions}
						onSelect={step === "select-from" ? handleFromSelect : handleToSelect}
						filterDirection={step === "select-from" ? "from" : "to"}
						fromOption={fromOption}
						toOption={toOption}
						fromCount={countAvailableFormats(matchingFrom, "from", isAdvanced)}
						toCount={countAvailableFormats(allOptions, "to", isAdvanced)}
						onClickFrom={handleFromToClickFrom}
						onClickTo={handleFromToClickTo}
					/>
				)}
			</main>

			{step !== "converting" && (
				<div className="conversion-action-bar">
					<div className="conversion-action-files">
						{Object.entries(SelectedFiles.value).map(([key, file]) => (
							<FileInfoBadge
								key={key}
								fileName={file.name}
								fileSize={file.size}
								extension={file.name.split(".").pop()}
								mimeType={file.type}
								onRemove={() => removeFile(key)}
							/>
						))}
					</div>
					<StyledButton
						disabled={files.length !== 1}
						title={files.length === 1 ? "Copy a MIME-correct data URL" : "Select one file to copy as Base64"}
						onClick={handleCopyBase64}
					>
						{base64Copied ? <Check size={15} /> : <Copy size={15} />}
						{base64Copied ? "Copied" : "Copy Base64"}
					</StyledButton>
					{step === "select-to" && (
						<StyledButton onClick={handleBack}>
							<ArrowLeft size={16} />
							Back
						</StyledButton>
					)}
					<StyledButton
						variant={ButtonVariant.Primary}
						disabled={!canProceed}
						onClick={step === "select-from" ? handleNext : handleConvert}
					>
						{step === "select-from" ? "Next" : "Convert"}
						{step === "select-from" && <ArrowRight size={16} />}
					</StyledButton>
				</div>
			)}

			<Footer />
		</div>
	);
}
