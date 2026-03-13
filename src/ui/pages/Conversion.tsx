import faImageRegular from '../img/fa-image-regular-full.svg'
import faBoxArchiveSolid from '../img/fa-box-archive-solid-full.svg'
import faFileLinesRegular from '../img/fa-file-lines-regular-full.svg'
import faVideoSolid from '../img/fa-video-solid-full.svg'
import faMusicSolid from '../img/fa-music-solid-full.svg'
import faInfinitySolid from '../img/fa-infinity-solid-full.svg'

import './Conversion.css'

import Footer from "../components/Footer"
import type { FormatCategory } from '../FormatCategories.ts'
import ConversionSidebar from "../components/Conversion/ConversionSidebar"
import SelectedFileInfo from "../components/Conversion/SelectedFileInfo"
import ConversionHeader from "../components/Conversion/ConversionHeader"
import { ConversionOptions, type ConversionOption, type ConversionOptionsMap } from 'src/main.new'

import FormatExplorer from "../components/Conversion/FormatExplorer.tsx"
import { useState } from "preact/hooks"

interface ConversionPageProps {

}

const sidebarItems: FormatCategory[] = [
    { id: 'all', categoryText: "All", icon: faInfinitySolid },
    { id: 'image', categoryText: "Image", icon: faImageRegular },
    { id: 'video', categoryText: "Video", icon: faVideoSolid },
    { id: 'audio', categoryText: 'Audio', icon: faMusicSolid },
    { id: 'archive', categoryText: "Archive", icon: faBoxArchiveSolid },
    { id: 'document', categoryText: "Document", icon: faFileLinesRegular },
]

/**
 * Flimsy getter to check to see if the conversion backend
 * borked and didn't return any conversion options
 */
function getConversionOptions() {
    if (ConversionOptions.size) {
        return ConversionOptions
    } else throw new Error("Can't build format list!", { cause: "UI got empty global format list" })
}


export default function Conversion({ }: ConversionPageProps) {
    /**
     * All available conversion options
     *
     * @type {ConversionOptionsMap}
     */
    const AvailableConversionOptions: ConversionOptionsMap = getConversionOptions()
    const [selectedOption, setSelectedOption] = useState<ConversionOption | null>(null)

    return (
        <div className="conversion-body">
            <ConversionHeader />

            {/* Mobile File Info */ }
            <SelectedFileInfo className="mobile-only" />

            <main className="conversion-main">
                <FormatExplorer categories={ sidebarItems } conversionOptions={ AvailableConversionOptions } onSelect={ setSelectedOption } />

                {/* Right Settings Sidebar / Bottom Settings Accordion */ }
                <ConversionSidebar conversionData={ selectedOption } />
            </main>
            <Footer visible={ false } />
        </div>
    )
}
