import Logo from "src/ui/components/Logo";
import AdvancedModeToggle from "src/ui/components/AdvancedModeToggle";

import "./index.css";

interface ConversionHeaderProps {
	stepLabel?: string;
}

export default function ConversionHeader({ stepLabel }: ConversionHeaderProps) {
	return (
		<header className="conversion-header">
			<div className="header-left">
				<Logo showName={true} size={24} />
				{stepLabel && <span className="header-step-label">{stepLabel}</span>}
			</div>

			<div className="header-right">
				<AdvancedModeToggle compact={true} />
			</div>
		</header>
	);
}
