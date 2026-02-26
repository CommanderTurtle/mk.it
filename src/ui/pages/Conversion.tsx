import logoImage from '../img/logo.svg';
import faImageRegular from '../img/fa-image-regular-full.svg';
import faBoxArchiveSolid from '../img/fa-box-archive-solid-full.svg';
import faFileLinesRegular from '../img/fa-file-lines-regular-full.svg';
import faVideoSolid from '../img/fa-video-solid-full.svg';
import faMusicSolid from '../img/fa-music-solid-full.svg';
import faMagnifyingGlassSolid from '../img/fa-magnifying-glass-solid-full.svg';

import './Conversion.css'

import { Icon } from "../components/Icon";

import DarkModeToggle from '../components/DarkModeToggle';
import FormatCard, { type FormatType } from "../components/Conversion/FormatCard";
import SideNav, { type FormatCategory } from "../components/Conversion/SideNav";
import Footer from "../components/Footer";
import ConversionSettings from "../components/Conversion/ConversionSettings";
import SelectedFileInfo from "../components/Conversion/SelectedFileInfo";
import { AllOptions } from 'src/main.new';

import { useDebouncedCallback } from 'use-debounce';
import { useState } from 'preact/hooks';

interface ConversionPageProps {

}

const sidebarItems: FormatCategory[] = [
    { category: "Archive", icon: faBoxArchiveSolid },
    { category: "Image", icon: faImageRegular, active: true },
    { category: "Document", icon: faFileLinesRegular },
    { category: "Video", icon: faVideoSolid },
    { category: "Audio", icon: faMusicSolid },
    { category: "E-Book", icon: faFileLinesRegular },
];

export type FormatTypeCard = FormatType & { id: string }
type SearchProps = Set<keyof FormatType>

export default function Conversion(props: ConversionPageProps | undefined) {
    const AvailableConversionFormats: FormatTypeCard[] = getConversionFormats();
    const [formatCards, setFormatCards] = useState(AvailableConversionFormats);
    const [selectedConversionFormat, setSelectedConversionFormat] = useState<string | null>(null);

    /**
     * Maps all supported formats into UI format cards
     */
    function getConversionFormats(): FormatTypeCard[] {
        if (AllOptions) {
            return AllOptions.map((oldFormat) => ({
                format: oldFormat.format.format,
                fullName: oldFormat.format.name,
                icon: faImageRegular, // placeholder
                mime: oldFormat.format.mime,
                id: `${oldFormat.format.name}-${oldFormat.format.mime}-${oldFormat.format.format}`
            }))
        } else throw new Error("Can't build format list! Failed to get global format list");
    }

    /**
     * Filter available cards according to the search term and where to search for it
     * @param term The term to search
     * @param searchWhere Where to search
     */
    function filterFormats(term: string, searchWhere: SearchProps): FormatTypeCard[] {
        let filteredFormats: FormatTypeCard[] = [];
        AvailableConversionFormats.forEach((format) => {
            searchWhere.forEach((prop) => {
                if ((format[prop] as string).toLowerCase().includes(term)) filteredFormats.push(format);
            })
        })
        return filteredFormats;
    }

    const debounceWaitMs = 250;
    /**
     * Search within these properties of the format cards
     */
    const searchProps: SearchProps = new Set(['fullName', 'format', 'mime']);
    /**
     * Debounce handler for the search.
     * If the input is empty, return all formats
     */
    const handleDebounceSearch = useDebouncedCallback((searchTerm) => {
        if (searchTerm === "") {
            setFormatCards(AvailableConversionFormats)
        } else {
            const searchResults = filterFormats(searchTerm, searchProps);
            setFormatCards(searchResults)
            console.debug("Debounced", searchResults)
        };
    }, debounceWaitMs)

    return (
        <div className="conversion-body">
            <header className="conversion-header">
                <div className="header-left">
                    <Icon
                        src={ logoImage }
                        size={ 40 }
                        color="var(--primary)"
                    />
                    <h1 className="conversion-title">Convert to it!</h1>
                </div>

                <div className="header-right">
                    {/* Desktop File Info */ }
                    <SelectedFileInfo className="desktop-only" />
                    <DarkModeToggle />
                </div>
            </header>

            {/* Mobile File Info */ }
            <SelectedFileInfo className="mobile-only" />

            <main className="conversion-main">
                <div className="content-wrapper">
                    {/* <SideNav items={ sidebarItems } /> */ }

                    {/* Center Browser */ }
                    <section className="format-browser">
                        <div className="search-container">
                            <div className="search-input-wrapper">
                                <Icon
                                    src={ faMagnifyingGlassSolid }
                                    className="icon"
                                    size={ 16 }
                                    color="var(--text-secondary)"
                                />
                                <input
                                    type="text"
                                    placeholder="Search for any format (e.g. PNG, MP4, WAV)..."
                                    onInput={ (ev) => handleDebounceSearch(ev.currentTarget.value) }
                                />
                            </div>
                        </div>

                        <div className="format-list-container scroller">
                            <div className="list-header desktop-only">
                                {/* <h2>Common Formats</h2> */}
                                <span>Showing { formatCards.length } formats</span>
                            </div>

                            <div className="format-grid">
                                {
                                    formatCards.map((card, i) => (
                                        <FormatCard
                                            selected={ card.id.concat(`-${i}`) === selectedConversionFormat }
                                            onSelect={ setSelectedConversionFormat }
                                            formatType={ card }
                                            key={ card.id.concat(`-${i}`) }
                                            id={ card.id.concat(`-${i}`) }
                                        />
                                    ))
                                }
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Settings Sidebar / Bottom Settings Accordion */ }
                <aside className="settings-sidebar">
                    <ConversionSettings />
                    <div className="spacer"></div>
                    <div className="action-footer">
                        <button className="btn-convert">Convert!</button>
                    </div>
                </aside>
            </main>
            <Footer visible={ false } />
        </div>
    );
}
