import { useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { popupOpen } from "../PopupStore";

import "./Popup.css";
import { PopupData } from "..";

export default function Popup() {
	const ref = useRef<HTMLDialogElement>(null);

	// Use vanilla JS APIs to control popup state
	useSignalEffect(() => {
		const elem = ref.current;

		if (!elem) {
			console.warn("Popup not present");
			return;
		}

		if (popupOpen.value) {
			if (!elem.open) elem.showModal();
		} else {
			if (elem.open) elem.close();
		}
	});

	// Listen to soft-dismiss events
	useEffect(() => {
		window.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (
				ev.key == "Escape"
				&& (typeof PopupData.value.dismissible === "undefined" || PopupData.value.dismissible)
			) ref.current?.close();
		})
	}, [])

	return (
		<dialog
			id="popup"
			ref={ ref }
		>
			<h1>{ PopupData.value.title }</h1>
			<p>{ PopupData.value.text }</p>
		</dialog>
	);
}
