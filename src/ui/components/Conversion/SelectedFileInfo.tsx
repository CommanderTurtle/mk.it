import type { CSSProperties } from "preact";

import faImageRegular from "../../img/fa-image-regular-full.svg";

import { Icon } from "../Icon";

import "./SelectedFileInfo.css"
import { SelectedFiles } from "src/main.new";

interface SelectedFileInfoProps {
    className?: string
    style?: CSSProperties
}

export default function SelectedFileInfo({ className = "", style = {} }: SelectedFileInfoProps) {
    return (
        <div className={ `file-info-badge ${className}` } style={ style }>
            <Icon
                src={ faImageRegular }
                size={ 16 }
                color="var(--text-secondary)"
            />
            <span className="file-name">{ SelectedFiles[0].name }</span>
        </div>
    );
}
