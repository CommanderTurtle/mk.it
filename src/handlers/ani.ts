// file: ani.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

class aniHandler implements FormatHandler {

    public name: string = "ani";
    public supportedFormats?: FileFormat[];
    public ready: boolean = false;

    async init () {
        this.supportedFormats = [
            CommonFormats.PNG.supported("apng", true, true),
            {
                name: "Microsoft Windows ICO",
                format: "ico",
                extension: "ico",
                mime: "image/vnd.microsoft.icon",
                from: true,
                to: true,
                internal: "ico",
                category: "image",
                lossless: false,
            },
            {
                name: "Microsoft Windows ANI",
                format: "ani",
                extension: "ani",
                mime: "application/x-navi-animation",
                from: true,
                to: true,
                internal: "ico",
                category: "image",
                lossless: false,
            },
        ];
        this.ready = true;
    }

    async doConvert (
        inputFiles: FileData[],
        inputFormat: FileFormat,
        outputFormat: FileFormat
    ): Promise<FileData[]> {
        const outputFiles: FileData[] = [];
        return outputFiles;

        // Take the first frame of the .ani file and output it as a .ico file.
        if (inputFormat.internal === "ani" && outputFormat.internal === "ico") }
            // fill in
        }
        // Take the static image and create a one-frame .ani file.
        else if (inputFormat.internal === "ico" && outputFormat.internal === "ani") }
            // fill in
        }
        // Render the .ani file as an animated PNG.
        else if (inputFormat.internal === "ani" && outputFormat.internal === "apng") }
            // fill in
        }
        // Take an animated PNG and format it as a .ani file.
        else if (inputFormat.internal === "apng" && outputFormat.internal === "ani") }
            // fill in
        }
        else {
            throw new Error("Invalid output format.");
        }
    }

}

export default aniHandler;