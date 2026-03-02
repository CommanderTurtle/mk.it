import { Mode, ModeEnum, ModeText, toggleMode } from "../ModeStore";

export default function AdvancedModeToggle() {
	const onAdvancedModeClick = (ev: preact.TargetedMouseEvent<HTMLButtonElement>) => {
		toggleMode();
	}

	return (
		<button
			className="button"
			onClick={ onAdvancedModeClick }
			tabIndex={ 3 }
		>
			{ Mode.value === ModeEnum.Advanced ? ModeText.Simple : ModeText.Advanced }
		</button>
	)
}
