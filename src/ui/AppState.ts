import { signal } from "@preact/signals";

import type { PopupDataContainer } from "./PopupStore";

export const enum Pages {
	Upload = "uploadPage",
	Conversion = "conversionPage",
	Ocr = "ocrPage",
	Combine = "combinePage"
}

export const CurrentPage = signal<Pages>(Pages.Upload);

export const PopupData = signal<PopupDataContainer>({
	title: "Loading tools...",
	text: "Please wait while the app loads conversion tools.",
	dismissible: false,
	buttonText: "Ignore"
});

export const LoadingToolsText = signal<string | undefined>("Loading formats…");
export const ConversionInProgress = signal(false);
