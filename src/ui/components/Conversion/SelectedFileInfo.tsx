import type { CSSProperties } from "preact";

import faImageRegular from "../../img/fa-image-regular-full.svg";
import faXRegular from "../../img/fa-x-solid-full.svg";

import { Icon } from "../Icon";

import "./SelectedFileInfo.css"
import { SelectedFiles } from "src/main.new";
import { useState } from "preact/hooks";
import { CurrentPage, Pages } from "src/ui";

interface SelectedFileInfoProps {
    className?: string
    style?: CSSProperties
}

interface FileInfoBadgeProps {
    filename: string
}

export default function SelectedFileInfo({ className = "", style = {} }: SelectedFileInfoProps) {

    function FileInfoBadge({ filename }: FileInfoBadgeProps) {
        const [deleteHover, setDeleteHover] = useState<boolean>(false);

        const handleMouseOver = () => {
            setDeleteHover(true);
        }

        const handleOnClick = () => {
            setDeleteHover(false);
            SelectedFiles.value = SelectedFiles.value.filter(f => f.name !== filename)
            if (SelectedFiles.value.length === 0) CurrentPage.value = Pages.Upload;
        }

        return (
            <div
                className={ `file-info-badge ${className}` }
                style={ style }
                onMouseOver={ handleMouseOver }
                onMouseOut={ () => setDeleteHover(false) }
                onClick={ handleOnClick }
            >
                <Icon
                    src={ deleteHover ? faXRegular : faImageRegular }
                    size={ 16 }
                    color="var(--text-secondary)"
                />
                <span className="file-name">{ filename }</span>
            </div>
        )
    }

    return (
        <div className={ `file-info-container ${className}` }>
            {
                SelectedFiles.value.map(file =>
                    <FileInfoBadge filename={ file.name } key={ file.name } />
                )
            }
        </div>
    );
}
