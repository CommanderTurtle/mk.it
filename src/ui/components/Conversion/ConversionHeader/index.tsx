import Logo from "src/ui/components/Logo";
import AdvancedModeToggle from "src/ui/components/AdvancedModeToggle";
import ProjectLinks from "src/ui/components/ProjectLinks";
import { goToUploadHome } from "src/main";

import "./index.css";

interface ConversionHeaderProps {
	stepLabel?: string;
	logoDisabled?: boolean;
}

export default function ConversionHeader({ stepLabel, logoDisabled = false }: ConversionHeaderProps) {
	return (
		<header className="conversion-header">
			<div className="header-left">
				<Logo showName={true} size={24} onClick={goToUploadHome} disabled={logoDisabled} />
				{stepLabel && <span className="header-step-label">{stepLabel}</span>}
			</div>

			<div className="header-right">
				<ProjectLinks />
				<AdvancedModeToggle compact={false} />
			</div>
		</header>
	);
}
