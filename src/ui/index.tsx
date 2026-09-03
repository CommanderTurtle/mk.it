import { render } from "preact";
import { useEffect } from "preact/hooks";

import UploadPage from "./pages/Upload";
import ConversionPage from "./pages/Conversion";
import OcrPage from "./pages/Ocr";
import CombinePage from "./pages/Combine";
import SharePage from "./pages/Share";
import { syncSharedFileFromLocation } from "src/main";
import { initTheme } from "./ThemeStore";
import Popup from "./components/Popup";
import FullPageDropOverlay from "./components/FullPageDropOverlay";
import { initMode } from "./ModeStore";
import { CurrentPage, Pages } from "./AppState";
import "./components/StyledButton/index.css";
export { CurrentPage, LoadingToolsText, Pages, PopupData } from "./AppState";

console.log("Rendering UI");

function App() {
	useEffect(() => {
		const sync = () => { syncSharedFileFromLocation(); };
		window.addEventListener("popstate", sync);
		window.addEventListener("hashchange", sync);
		return () => {
			window.removeEventListener("popstate", sync);
			window.removeEventListener("hashchange", sync);
		};
	}, []);

	return (
		<>
			{CurrentPage.value === Pages.Conversion && <ConversionPage />}
			{CurrentPage.value === Pages.Upload && <UploadPage />}
			{CurrentPage.value === Pages.Ocr && <OcrPage />}
			{CurrentPage.value === Pages.Combine && <CombinePage />}
			{CurrentPage.value === Pages.Share && <SharePage />}
			<FullPageDropOverlay />
			<Popup />
		</>
	);
}

syncSharedFileFromLocation();
render(<App />, document.body);

initTheme();
initMode();
