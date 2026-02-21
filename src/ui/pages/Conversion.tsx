
import DarkModeToggle from '../components/DarkModeToggle';

import './Conversion.css'

import { Icon } from "../components/Icon.tsx";

import logoImage from '../img/logo.svg';
import faImageRegular from '../img/fa-image-regular-full.svg';
import faBoxArchiveSolid from '../img/fa-box-archive-solid-full.svg';
import faFileLinesRegular from '../img/fa-file-lines-regular-full.svg';
import faVideoSolid from '../img/fa-video-solid-full.svg';
import faMusicSolid from '../img/fa-music-solid-full.svg';
import faMagnifyingGlassSolid from '../img/fa-magnifying-glass-solid-full.svg';
import faWrenchSolid from '../img/fa-wrench-solid-full.svg';
import faChevronDownSolid from '../img/fa-chevron-down-solid-full.svg';
import faSlidersSolid from '../img/fa-sliders-solid-full.svg';
import faLinkSolid from '../img/fa-link-solid-full.svg';
import { useState } from "preact/hooks";
import FormatCard, {type FormatType} from "../components/FormatCard.tsx";
import SideNav, {type FormatCategory} from "../components/SideNav.tsx";
import Footer from "../components/Footer.tsx";

interface ConversionPageProps {

}

export default function Conversion(props: ConversionPageProps | undefined) {
    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

    const sidebarItems: FormatCategory[] = [
        { category: "Archive", icon: faBoxArchiveSolid },
        { category: "Image", icon: faImageRegular, active: true },
        { category: "Document", icon: faFileLinesRegular },
        { category: "Video", icon: faVideoSolid },
        { category: "Audio", icon: faMusicSolid },
        { category: "E-Book", icon: faFileLinesRegular },
    ]

    const formatCards: FormatType[] = [
        { format: "PNG", fullName: "Portable Network Graphics", mime: "image/png", icon: faImageRegular, active: true },
        { format: "JPG", fullName: "JPEG Image", mime: "image/jpeg", icon: faImageRegular },
        { format: "WEBP", fullName: "WebP Image", mime: "image/webp", icon: faImageRegular },
        { format: "GIF", fullName: "CompuServe GIF", mime: "image/gif", icon: faImageRegular },
        { format: "TIFF", fullName: "Tagged Image File", mime: "image/tiff", icon: faImageRegular },
        { format: "BMP", fullName: "Bitmap", mime: "image/bmp", icon: faImageRegular },
        { format: "SVG", fullName: "Scalable Vector Graphics", mime: "image/svg+xml", icon: faImageRegular },
        { format: "HEIC", fullName: "High Efficiency Image File", mime: "image/heic", icon: faImageRegular },
        { format: "RAW", fullName: "Raw Image Data", mime: "image/x-raw", icon: faImageRegular },
    ];

    const toggleSettings = () => {
        setIsSettingsExpanded(!isSettingsExpanded);
    };

    return (
        <div className="conversion-body">
            <header className="conversion-header">
                <div className="header-left">
                    <Icon
                        src={ logoImage }
                        size={ 40 }
                        color="var(--primary)"
                        className="upload-card-logo"
                    />
                    <h1 className="conversion-title">Convert to it!</h1>
                </div>

                <div className="header-right">
                    {/* Desktop File Info */ }
                    <div className="file-info-badge desktop-only">
                        <Icon
                            src={ faImageRegular }
                            size={ 16 }
                            color="var(--text-secondary)"
                        />
                        <span className="file-name">some_image.svg</span>
                        <select className="format-select">
                            <option value="svg">SVG</option>
                            <option value="png">PNG</option>
                            <option value="webp">WEBP</option>
                            <option value="jpeg">JPEG</option>
                        </select>
                        <span className="file-size">2.52 KB</span>
                    </div>

                    <DarkModeToggle />
                </div>
            </header>

            {/* Mobile File Info */ }
            <div className="mobile-file-bar mobile-only">
                <div className="file-info-badge">
                    <Icon src={ faImageRegular } size={ 16 } color="var(--text-secondary)" />
                    <span className="file-name">some_image.svg</span>
                    <select className="format-select">
                        <option value="svg">SVG</option>
                        <option value="png">PNG</option>
                        <option value="webp">WEBP</option>
                        <option value="jpeg">JPEG</option>
                    </select>
                    <span className="file-size">2.52 KB</span>
                </div>
            </div>

            <main className="conversion-main">
                <div className="content-wrapper">
                    <SideNav items={sidebarItems}/>

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
                                />
                            </div>
                        </div>

                        <div className="format-list-container scroller">
                            <div className="list-header desktop-only">
                                <h2>Common Formats</h2>
                                <span>Showing { formatCards.length } formats</span>
                            </div>

                            <div className="format-grid">
                                { formatCards.map((card, index) => (
                                    <FormatCard formatType={card}/>
                                )) }
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Settings Sidebar / Bottom Settings Accordion */ }
                <aside className={ `settings-sidebar ${isSettingsExpanded ? 'is-expanded' : ''}` }>
                    <div className="mobile-settings-header mobile-only" onClick={ toggleSettings }>
                        <h3>
                            <Icon
                                src={ faWrenchSolid }
                                size={ 16 }
                                color="var(--text-secondary)"
                            />{ " " }
                            Options
                        </h3>
                        <Icon
                            src={ faChevronDownSolid }
                            size={ 16 }
                            color="var(--text-secondary)"
                            className={ `chevron-icon ${isSettingsExpanded ? 'rotate' : ''}` }
                        />
                    </div>

                    <div className="settings-header desktop-only">
                        <h3>
                            <Icon
                                src={ faSlidersSolid }
                                size={ 16 }
                                color="var(--text-secondary)"
                            />{ " " }
                            Output Settings
                        </h3>
                    </div>

                    <div className="collapsible-wrapper">
                        <div className="settings-content scroller">
                            <div className="input-group">
                                <label className="group-label">Resolution</label>
                                <div className="dual-input">
                                    <div className="input-wrapper floating-label">
                                        <label>Width</label>
                                        <input type="number" placeholder="Auto" />
                                    </div>

                                    <div className="link-icon-wrapper">
                                        <Icon src={ faLinkSolid } size={ 14 } className="link-icon" />
                                    </div>

                                    <div className="input-wrapper floating-label">
                                        <label>Height</label>
                                        <input type="number" placeholder="Auto" />
                                    </div>
                                </div>
                            </div>

                            <div className="divider">
                                <div className="line"></div>
                                <span className="divider-text">OR</span>
                                <div className="line"></div>
                            </div>

                            <div className="input-group">
                                <label className="group-label">Pixel Density</label>
                                <div className="input-wrapper unit-right">
                                    <input type="text" defaultValue="96" />
                                    <span className="unit">DPI</span>
                                </div>
                            </div>

                            <div className="divider">
                                <div className="line"></div>
                            </div>

                            <div className="input-group">
                                <label className="group-label">Color Profile</label>
                                <select className="full-select">
                                    <option>sRGB (Web Safe)</option>
                                    <option>Adobe RGB</option>
                                    <option>CMYK (Print)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="spacer"></div>
                    <div className="action-footer">
                        <button className="btn-convert">Convert!</button>
                    </div>
                </aside>
            </main>
            <Footer/>
        </div>
    );
}
