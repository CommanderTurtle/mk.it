import type { FormatTypeCard } from "src/ui/pages/Conversion";
import { Icon } from "../Icon";

import "./FormatCard.css";
import { SimpleMode } from "src/main.new";

export type FormatType = {
    format: string
    fullName: string
    mime: string
    icon: string
    active?: boolean
}

interface FormatCardProps {
    formatType: FormatType
    id: string
    selected: boolean
    handler: string
    onSelect: (id: string) => void
}

export default function FormatCard(props: FormatCardProps) {
    const formatData: FormatType =
        "formatType" in props ? props.formatType : props;

    return (
        <div className={ `format-card ${props.selected ? "active" : ""}` } onClick={ () => props.onSelect(props.id) }>
            {/* Mobile Card Layout */ }
            <div className="card-mobile-header mobile-only">
                <div className="card-title-group">
                    <span className={ formatData.active ? "badge" : "badge gray" }>
                        { formatData.format }
                    </span>
                    <h3>{ formatData.fullName }</h3>
                    <p className="mime-type">({ formatData.mime })</p>
                </div>
                <div className="card-icon-sm">
                    <Icon src={ formatData.icon } size={ 16 } />
                </div>
            </div>

            {/* Desktop Card Layout */ }
            <div className="card-desktop-content desktop-only">
                <div className="card-top">
                    <div className="card-icon-lg">
                        <Icon src={ formatData.icon } size={ 32 } />
                    </div>
                    <span className="badge">
                        { formatData.format }
                    </span>
                    {
                        (!SimpleMode) && (<span className="badge gray">
                            { props.handler }
                        </span>)
                    }
                </div>
                <h3>{ formatData.fullName }</h3>
                <p className="mime-type">({ formatData.mime })</p>
            </div>
        </div>
    );
}
