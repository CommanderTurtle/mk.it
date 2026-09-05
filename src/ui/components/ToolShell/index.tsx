import { ArrowLeft } from "lucide-preact";
import type { ComponentChildren } from "preact";

import { goToUploadHome } from "src/main";
import Footer from "src/ui/components/Footer";
import Logo from "src/ui/components/Logo";
import ProjectLinks from "src/ui/components/ProjectLinks";
import StyledButton from "src/ui/components/StyledButton";

import "./index.css";

interface ToolShellProps {
	title: string;
	description: string;
	children: ComponentChildren;
}

export default function ToolShell({ title, description, children }: ToolShellProps) {
	return (
		<div className="tool-page">
			<header className="tool-header">
				<div className="tool-header-left">
					<Logo showName={true} size={24} onClick={goToUploadHome} />
					<span className="tool-header-divider" />
					<span className="tool-header-label">{title}</span>
				</div>
				<div className="project-header-actions">
					<ProjectLinks />
					<StyledButton onClick={goToUploadHome}><ArrowLeft size={15} /> All tools</StyledButton>
				</div>
			</header>
			<main className="tool-main">
				<div className="tool-intro">
					<h1>{title}</h1>
					<p>{description}</p>
				</div>
				{children}
			</main>
			<Footer />
		</div>
	);
}
