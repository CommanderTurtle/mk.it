import { render } from "preact";
import { signal } from "@preact/signals";

import UploadPage from "./pages/Upload";
import ConversionPage from "./pages/Conversion";
import { initTheme } from "./theme";
import type { PopupDataContainer } from "./PopupStore";
import Popup from "./components/Popup";

console.log("Rendering UI");

export const enum Pages {
	Upload = "uploadPage",
	Conversion = "conversionPage"
}

export const CurrentPage = signal<Pages>(Pages.Upload);
export let PopupData = signal<PopupDataContainer>({
	title: "Loading tools...",
	text: "Please wait while the app loads conversion tools.",
	dismissible: false
})

function App() {
	return (
		<>
			{ CurrentPage.value === Pages.Conversion && <ConversionPage /> }
			{ CurrentPage.value === Pages.Upload && <UploadPage /> }
			<Popup />
		</>
	)
}

/**
 * Debug function to change pages without user workflow
*/
// @ts-expect-error
window.changePage = (page: Pages) => {
	CurrentPage.value = page
}

render(<App />, document.body);

initTheme();
